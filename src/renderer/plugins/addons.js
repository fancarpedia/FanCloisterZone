import os from 'os'
import fs from 'fs'
import path from 'path'
import https from 'https'

import sortBy from 'lodash/sortBy'
import uniq from 'lodash/uniq'
import isNumber from 'lodash/isNumber'
import unzipper from 'unzipper'
import sha256File from 'sha256-file'
import { compare } from 'compare-versions'
import Vue from 'vue'
import { File } from 'megajs'
import { ipcRenderer } from 'electron'
import fetch from 'node-fetch'
import semver from 'semver'

import { getAppVersion } from '@/utils/version'
import { EventsBase } from '@/utils/events'

const CLASSIC_ADDON_KEY = 'classic'
const MEGA_PROVIDER = 'mega'
const HTTPS_PROVIDER = 'https'

class Addons extends EventsBase {
  constructor(ctx) {
    super()

    this.AUTO_DOWNLOADED = null
    this.ctx = ctx
    this.addons = []
    this.downloadableInitialized = 0
    this.downloadableManifestUrl = null
    this.downloadableManifestError = null
    this.downloadable = []
  }

  async _ensureAutoDownloaded() {
    if (this.AUTO_DOWNLOADED === null) {
      this.AUTO_DOWNLOADED = await ipcRenderer.invoke('get-addon-defaults')
    }
  }

  async _getManifestUrl() {
    await this._ensureAutoDownloaded()

    const configuredUrl = this.ctx.store.state.settings.addonsManifestUrl
    const normalizedUrl = typeof configuredUrl === 'string' ? configuredUrl.trim() : ''
    return normalizedUrl || this.AUTO_DOWNLOADED?.addonsManifestUrl
  }

  _getLatestVersionDefinition(addonDefinition) {
    if (!addonDefinition?.versions?.length) {
      return null
    }

    return addonDefinition.versions.reduce((latestVersion, version) => (
      !latestVersion || version.version > latestVersion.version ? version : latestVersion
    ), null)
  }

  _reportManifestError(message) {
    if (this.downloadableManifestError === message) {
      return
    }

    this.downloadableManifestError = message
    this.ctx.app.store.commit('errorMessage', {
      title: 'Invalid add-ons manifest',
      content: message
    }, { root: true })
  }

  async getDefaultArtworkUrl() {
    const downloadable = await this.getDownloadable()
    const classic = downloadable.find(({ key }) => key === CLASSIC_ADDON_KEY)
    const versionDefinition = this._getLatestVersionDefinition(classic)
    if (versionDefinition) {
      const urls = Array.isArray(versionDefinition.url) ? versionDefinition.url : [versionDefinition.url]
      return urls.filter(Boolean)
    }

    return []
  }

  async getDownloadable() {
    const manifestUrl = await this._getManifestUrl()
    const needsRefresh = this.downloadableInitialized === 0 || this.downloadableManifestUrl !== manifestUrl
    if (!needsRefresh) {
      return this.downloadable
    }

    if (this.downloadableManifestUrl !== manifestUrl) {
      this.downloadable = []
      this.downloadableManifestUrl = manifestUrl
      this.downloadableManifestError = null
    }

    if (!manifestUrl) {
      return this.downloadable
    }

    try {
      const res = await fetch(manifestUrl)
      if (res.status === 200) {
        const addons = await res.json()
        const appVersion = await ipcRenderer.invoke('get-app-version')
        const isDev = /-alpha|-beta|-rc/i.test(appVersion)
        const appVer = semver.coerce(appVersion)

        this.downloadable = (addons.addons || [])
          .map(addon => {
            const addonVersions = Array.isArray(addon.versions) ? addon.versions : []
            const compatibleVersions = addonVersions.filter(version => {
              const fromVersion = isDev ? (version.devFromVersion ?? (version.fromVersion ?? null)) : (version.fromVersion ?? null)
              const fromOk = fromVersion ? semver.gte(appVer, semver.coerce(fromVersion)) : true
              const toVersion = isDev ? (version.devToVersion ?? (version.toVersion ?? null)) : (version.toVersion ?? null)
              const toOk = toVersion ? semver.lt(appVer, semver.coerce(toVersion)) : true // exclusive upper bound
              return fromOk && toOk
            })
            if (compatibleVersions.length > 0) {
              return { ...addon, autoUpdate: addon.autoUpdate !== false, versions: compatibleVersions }
            }
            return null
          })
          .filter(addon => addon !== null)

        const classicAddon = this.downloadable.find(({ key }) => key === CLASSIC_ADDON_KEY)
        const classicVersionDefinition = this._getLatestVersionDefinition(classicAddon)
        console.debug('Classic add-on version definition from manifest:', classicVersionDefinition)
        if (!classicVersionDefinition) {
          this._reportManifestError('Add-ons manifest must contain a compatible classic add-on.')
          this.downloadableInitialized = 1
          return this.downloadable
        }

        if (!classicVersionDefinition.sha256) {
          this._reportManifestError('Classic add-on entry in manifest must include sha256.')
          this.downloadableInitialized = 1
          return this.downloadable
        }

        this.downloadableInitialized = 1
      }
    } catch (err) {
      // No internet?
    }
    return this.downloadable
  }

  async loadAddons() {
    const { settings } = this.ctx.store.state
    const userDataPath = window.process.argv.find(arg => arg.startsWith('--user-data=')).replace('--user-data=', '')
    const installedAddons = []
    const installedAddonsIds = new Set()

    const readFolder = async (folder, { removable, hidden }) => {
      let listing
      try {
        listing = await fs.promises.readdir(folder)
      } catch (e) {
        console.log(`${folder} does not exist`)
        return
      }
      for (const id of listing) {
        // when same artwork is on path twice, register first found
        // this allowes overide from user path
        if (!installedAddonsIds.has(id)) {
          const fullPath = path.join(folder, id)
          const addon = await this._readAddon(id, fullPath)
          if (addon) {
            addon.removable = removable && id !== CLASSIC_ADDON_KEY
            addon.hidden = hidden
            installedAddons.push(addon)
            installedAddonsIds.add(id)
          }
        }
      }
    }

    for (const fullPath of settings.userAddons) {
      const addon = await this._readAddon(path.basename(fullPath), fullPath)
      if (addon) {
        addon.removable = false
        addon.hidden = false
        if (!installedAddonsIds.has(addon.id)) {
          installedAddons.push(addon)
          installedAddonsIds.add(addon.id)
        }
      }
    }

    await readFolder(process.resourcesPath + '/addons/', { removable: false, hidden: true })
    await readFolder(path.join(userDataPath, 'addons'), { removable: true, hidden: false })

    await this.updateOutdatedClassic(installedAddons)

    // console.log('Installed addons: ', installedAddons.filter(addon => !addon.error))

    for (const addon of installedAddons) {
      if (addon.error) {
        console.error(`Can't load ${addon.id} add-on: ${addon.error}`)
        continue
      }
      addon.artworks = []
      for (const relPath of (addon.json.artworks || [])) {
        const fullPath = path.join(addon.folder, relPath)
        const artwork = await this._readArtwork(addon.id + '/' + path.basename(fullPath), fullPath)
        addon.artworks.push(artwork)
      }
    }

    this.ctx.app.store.commit('hasClassicAddon', !!installedAddons.find(a => a.id === CLASSIC_ADDON_KEY && !a.error))

    this.addons = sortBy(installedAddons, ['removable', 'id'])
    this.ctx.app.store.commit('addonsLoaded')
  }

  async mkAddonsFolder() {
    const userDataPath = window.process.argv.find(arg => arg.startsWith('--user-data=')).replace('--user-data=', '')
    const addonsFolder = path.join(userDataPath, 'addons')
    await fs.promises.mkdir(addonsFolder, { recursive: true })
    return addonsFolder
  }

  async installDownloadable(addonKey, version) {
    const downloadable = await this.getDownloadable()
    if (!downloadable) {
      throw new Error($nuxt.$t('settings.add-ons.add-ons-definition-not-available'))
    }

    const addonDefinition = downloadable.find(a => a.key === addonKey)
    if (!addonDefinition) {
      throw new Error($nuxt.$t('settings.add-ons.download-definition-not-found'))
    }

    const versionDefinition = addonDefinition.versions.find(v => v.version === version)
    if (!versionDefinition) {
      throw new Error($nuxt.$t('settings.add-ons.missing-available-version'))
    }

    const downloadedPath = path.join(os.tmpdir(), `${addonKey}-v${versionDefinition.version}.jca`)

    const downloadUrl = await this.resolveDownloadUrl(versionDefinition.url)
    if (!downloadUrl) {
      throw new Error($nuxt.$t('settings.add-ons.download-definition-not-found'))
    }

    const installed = this.addons.find(a => a.id === addonKey)
    if (installed) {
      const installedVersion = installed.json.version
      const requestedVersion = versionDefinition.version

      if (installedVersion >= requestedVersion) {
        return
      }

      console.log(`Reinstalling ${addonKey}: v${installedVersion} → v${requestedVersion}`)
      await this.uninstall(installed)
    }

    // Download provider
    await this.downloadAddonFile(versionDefinition.provider, downloadUrl, downloadedPath)

    // --- SHA-256 verification ---
    if (versionDefinition.sha256) {
      const checksum = sha256File(downloadedPath)
      if (checksum !== versionDefinition.sha256) {
        await fs.promises.unlink(downloadedPath)
        throw new Error($nuxt.$t('settings.add-ons.downloaded-file-checksum-mismatch'))
      }
    }
    // Install after verification
    await this.install(downloadedPath)
  }

  async resolveDownloadUrl(urls) {
    if (!Array.isArray(urls)) {
      return urls || null
    }

    for (const currentUrl of urls.filter(Boolean)) {
      try {
        if (await this.urlExists(currentUrl)) {
          return currentUrl
        }
      } catch (error) {
        continue
      }
    }

    return null
  }

  async downloadAddonFile(provider, link, downloadFileName) {
    try {
      await fs.promises.unlink(downloadFileName)
    } catch {
      // file does not exist, no need to delete
    }

    let fileStream
    try {
      fileStream = fs.createWriteStream(downloadFileName)
    } catch (err) {
      console.warn(`Error creating write stream for ${downloadFileName}:`, err)
      throw new Error($nuxt.$t('settings.add-ons.download-file-write-error'))
    }

    try {
      await new Promise((resolve, reject) => {
        switch (provider) {
          case MEGA_PROVIDER:
            this.downloadFromMega(link, fileStream, downloadFileName, resolve, reject)
            break;
          case HTTPS_PROVIDER:
            this.downloadFileFromUrl(link, fileStream, downloadFileName, resolve, reject)
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`)
        }
      });
    } catch (e) {
      console.error(`Error downloading add-on file (${downloadFileName}) with provider ${provider}:`, e)
      await fs.promises
        .unlink(downloadFileName)
        .catch(err => {
          console.warn(`Error deleting incomplete add-on file (${downloadFileName}):`, err)
        })
      throw e
    }
  }

  downloadFromMega(link, fileStream, downloadFileName, resolve, reject) {
    try {
      const megaFile = File.fromURL(link)
      let downloadedBytes = 0

      // Set total size if available
      megaFile.loadAttributes().then(() => {
        this.ctx.app.store.commit('downloadSize', megaFile.size)
      }).catch(err => console.warn('Could not load Mega file size:', err))

      megaFile
        .download()
        .on('data', chunk => {
          downloadedBytes += chunk.length
          this.ctx.app.store.commit('downloadProgress', downloadedBytes)
        })
        .pipe(fileStream)
        .on('error', function (err) {
          console.error(err)
          fs.unlink(downloadFileName, unlinkErr => {
            console.warn(unlinkErr)
          })
          reject(err.message)
        })
        .on('finish', function () {
          fileStream.close(resolve)
        })
    } catch (error) {
      console.error(error)
      fs.unlink(downloadFileName, unlinkErr => {
        console.warn(unlinkErr)
      })
      reject(error.message)
    }
  }

  async install(filePath) {
    const addonsFolder = await this.mkAddonsFolder()

    const tmpFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'addon-'))

    // TODO UNPACK FIRST TO TEMP DIR AND VALIDATE
    await fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tmpFolder }))
      .promise()

    const listing = await fs.promises.readdir(tmpFolder)
    if (listing.length !== 1) {
      throw new Error($nuxt.$t('settings.add-ons.invalid-add-on-multiple-folders-in-root'))
    }
    const id = listing[0]
    if (this.addons.find(addon => addon.id === id)) {
      throw new Error($nuxt.$t('settings.add-ons.add-on-already-installed', { id: id }))
    }

    const tmpAddonPath = path.join(tmpFolder, id)
    const addon = await this._readAddon(id, tmpAddonPath)
    if (addon.error) {
      throw new Error(addon.error)
    }

    await fs.promises.rename(tmpAddonPath, path.join(addonsFolder, id))

    await fs.promises.rmdir(tmpFolder, { recursive: true })

    const enabledArtworks = uniq([...this.ctx.store.state.settings.enabledArtworks, ...addon.json.artworks.map(artwork => `${id}/${artwork}`)])
    await this.ctx.store.dispatch('settings/update', { enabledArtworks })

    await new Promise(resolve => {
      this.emitter.emit('change')
      resolve()
    })
  }

  async uninstall(addon) {
    await fs.promises.rmdir(addon.folder, { recursive: true })

    if (addon.artworks?.length) { // may be undefined for invalid artwork
      const ids = addon.artworks.map(a => a.id)
      const enabledArtworks = this.ctx.store.state.settings.enabledArtworks.filter(id => !ids.includes(id))
      await this.ctx.store.dispatch('settings/update', { enabledArtworks })
    }
    await new Promise(resolve => {
      this.emitter.emit('change')
      resolve()
    })
    this.addons = this.addons.filter(a => a.id !== addon.id)

  }

  async urlExists(url) {
    // Check if it's a Mega.nz link
    if (url.includes('mega.nz')) {
      return await this.checkMegaFile(url)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      return response.ok
    } catch (error) {
      console.warn(`Fetch failed: ${error.message}`)
      return false
    }
  }

  async checkMegaFile(url) {
    try {
      const file = File.fromURL(url)
      await file.loadAttributes()
      return true
    } catch (error) {
      console.warn(`Error checking URL ${url}: ${error.message}`)
      return false
    }
  }

  async updateOutdatedClassic(installedAddons) {
    const downloadable = await this.getDownloadable()
    const classicDownloadable = downloadable.find(({ key }) => key === CLASSIC_ADDON_KEY)
    const classicVersionDefinition = this._getLatestVersionDefinition(classicDownloadable)

    if (!classicVersionDefinition) {
      return
    }

    const classicAutoUpdate = classicDownloadable.autoUpdate !== false

    const classicArtwork = installedAddons.find(({ id }) => id === CLASSIC_ADDON_KEY)
    if (classicArtwork) {
      if (!classicArtwork.outdated && !classicArtwork.error) {
        return
      }
      if (!classicAutoUpdate) {
        return
      }
      installedAddons.splice(installedAddons.indexOf(classicArtwork), 1)
    }

    const addonsFolder = await this.mkAddonsFolder()
    const fullPath = path.join(addonsFolder, CLASSIC_ADDON_KEY)

    try {
      const stat = await fs.promises.stat(fullPath)
      if (stat.isDirectory() && !classicArtwork?.outdated && !classicArtwork?.error) {
        const artwork = await this._readAddon(CLASSIC_ADDON_KEY, fullPath)
        installedAddons.unshift(artwork)
        return
      }
    } catch {
      // fullPath doesn't exist yet, proceed with download
    }

    const links = Array.isArray(classicVersionDefinition.url)
      ? classicVersionDefinition.url
      : [classicVersionDefinition.url]
    const downloadUrl = await this.resolveDownloadUrl(links)

    if (!downloadUrl) {
      this.ctx.app.store.commit('download', null)
      return
    }

    console.log('Updating classic artwork, download link: ' + downloadUrl)
    console.log('expected sha256: ' + classicVersionDefinition.sha256)
    console.log('Downloading to ' + fullPath)

    this.ctx.app.store.commit('download', {
      name: 'classic.jca',
      description: 'Downloading classic artwork',
      progress: null,
      size: null,
      link: downloadUrl
    })

    const downloadedPath = path.join(addonsFolder, 'classic.jca')
    const downloadProvider = classicVersionDefinition.provider || HTTPS_PROVIDER
    await this.downloadAddonFile(downloadProvider, downloadUrl, downloadedPath)

    const expectedChecksum = classicVersionDefinition.sha256
    if (!expectedChecksum) {
      this._reportManifestError('Classic add-on entry in manifest must include sha256.')
      this.ctx.app.store.commit('download', null)
      await fs.promises.unlink(downloadedPath)
      return
    }

    const checksum = sha256File(downloadedPath)
    if (checksum !== expectedChecksum) {
      console.log('classic.jca checksum mismatch ' + checksum)
      this.ctx.app.store.commit('download', {
        name: 'classic.jca',
        description: 'Error: Downloaded file has invalid checksum',
        progress: 0,
        size: null,
        link: downloadUrl
      })
      await fs.promises.unlink(downloadedPath)
      return
    }

    console.log('classic.jca downloaded. sha256: ' + checksum)
    if (classicArtwork?.outdated) {
      console.log('Removing outdated artwork ' + classicArtwork.folder)
      await fs.promises.rmdir(classicArtwork.folder, { recursive: true })
    }
    await fs.createReadStream(downloadedPath)
      .pipe(unzipper.Extract({ path: addonsFolder }))
      .promise()
    await fs.promises.unlink(downloadedPath)
    this.ctx.app.store.commit('download', null)

    const artwork = await this._readAddon(CLASSIC_ADDON_KEY, fullPath)
    installedAddons.unshift(artwork)
  }

  downloadFileFromUrl(link, downloadStream, downloadFileName, resolve, reject, redirectCount = 0) {
    let downloadedBytes = 0
    let completed = false

    const finishWithError = (error) => {
      if (completed) {
        return
      }
      completed = true
      console.error(error)
      fs.unlink(downloadFileName, unlinkErr => {
        console.warn(unlinkErr)
      })
      reject(error.message)
    }

    const agent = new https.Agent({ rejectUnauthorized: false })

    https.get(link, { agent }, response => {
      const statusCode = response.statusCode || 0
      const location = response.headers.location

      if (statusCode >= 300 && statusCode < 400 && location) {
        if (redirectCount >= 10) {
          response.resume()
          finishWithError(new Error(`Too many redirects while downloading ${downloadFileName}`))
          return
        }

        const nextLink = new URL(location, link).toString()
        console.log(`Redirecting download ${statusCode} -> ${nextLink}`)
        response.resume()
        this.downloadFileFromUrl(nextLink, downloadStream, downloadFileName, resolve, reject, redirectCount + 1)
        return
      }

      const totalHeader = response.headers['content-length']
      const total = totalHeader ? parseInt(totalHeader, 10) : NaN
      const hasKnownSize = Number.isFinite(total) && total > 0

      this.ctx.app.store.commit('downloadSize', hasKnownSize ? total : null)
      console.log(hasKnownSize ? `Total size: ${total} bytes` : `Total size unavailable for ${link}`)

      response.on('data', chunk => {
        downloadedBytes += chunk.length
        if (hasKnownSize) {
          console.log(`Downloaded ${downloadedBytes} of ${total} bytes`)
        }
        this.ctx.app.store.commit('downloadProgress', downloadedBytes)
      })

      const responseErrorHandler = err => finishWithError(err)
      response.on('error', responseErrorHandler)
      downloadStream.on('error', responseErrorHandler)

      response.pipe(downloadStream)
      downloadStream.on('finish', function () {
        if (completed) {
          return
        }
        completed = true
        console.log('Download finished, file saved to ' + downloadFileName)
        downloadStream.close(resolve)
      })
    }).on('error', function (err) {
      finishWithError(err)
    })
  }

  async updateOutdatedAddons() {
    const installedAddons = this.addons
    const downloadable = await this.getDownloadable()

    let updated = false

    for (const installed of installedAddons) {
      const addon = installed.id
      const available = downloadable.find(({ key }) => key === addon)

      if (!available) continue

      if (available.autoUpdate === false) continue

      // get the highest available version
      const newest = available.versions.reduce((max, v) =>
        v.version > max.version ? v : max
      )
      if (newest.version > installed.json.version) {
        console.log(`Updating ${addon}: v${installed.json.version} → v${newest.version}`)

        try {
          updated = true
          await this.uninstall(installed)
          await this.installDownloadable(addon, newest.version)
        } catch (err) {
          console.error(`Failed updating ${addon}`, err)
        }
      }
      if (updated) {
        await this.loadAddons()
        if (this.$theme) {
          await this.$theme.loadArtworks()
        }
        if (this.$tiles) {
          await this.$tiles.loadExpansions()
        }
      }
    }

  }

  findMissingAddons(required) {
    const installed = this.addons.reduce((acc, addon) => {
      acc[addon.id] = addon.json.version
      return acc
    }, {})
    const missing = []
    Object.entries(required).forEach(([addon, version]) => {
      if (installed[addon] === undefined) {
        missing.push(addon)
      } else if (installed[addon] < version) {
        missing.push(`${addon} (requires v${version})`)
      }
    })
    return missing
  }

  async _readAddon(id, fullPath) {
    const stats = await fs.promises.stat(fullPath)
    if (stats.isDirectory()) {
      const jsonPath = path.join(fullPath, 'jcz-addon.json')
      let json
      try {
        json = JSON.parse(await fs.promises.readFile(jsonPath))
      } catch (e) {
        // not plugin folder, do nothing
        return null
      }
      try {
        json.id = id
        const remoteDownloadable = (await this.getDownloadable()).find(({ key }) => key === id)
        const addon = {
          id,
          title: json.title,
          folder: fullPath,
          json,
          remote: this._getLatestVersionDefinition(remoteDownloadable)
        }
        if (!isNumber(addon.json.version)) {
          addon.error = 'Invalid add-on. Expecting number as version found string.'
        } else if (parseInt(addon.json.version) !== addon.json.version) {
          addon.error = `Invalid add-on. Expecting integer number as version, found ${addon.json.version}`
        } else if (!addon.json.minimumJczVersion) {
          addon.error = 'Invalid add-on. Missing minimumJczVersion.'
        } else if (compare(getAppVersion(), addon.json.minimumJczVersion, '<')) {
          addon.error = `Add-on requires JCZ ${addon.json.minimumJczVersion} or higher`
        } else if (addon.remote) {
          if (addon.json.version !== addon.remote.version) {
            const currentVersion = addon.json.version
            const requiredVersion = addon.remote.version
            if (currentVersion < requiredVersion) {
              console.log(`Artwork ${id} is outdated (current ${currentVersion}, reqired ${requiredVersion})`)
              addon.outdated = true
            }
          }
        }
        return addon
      } catch (e) {
        // unexpected error
        console.error(e)
      }
    }
    return null
  }

  async _readArtwork(id, fullPath) {
    const stats = await fs.promises.stat(fullPath)
    if (stats.isDirectory()) {
      const jsonPath = path.join(fullPath, 'artwork.json')
      let json
      try {
        json = JSON.parse(await fs.promises.readFile(jsonPath))
      } catch (e) {
        // not plugin folder, do nothing
        return null
      }
      try {
        json.id = id
        if (json.icon) {
          json.icon = 'file://' + path.join(fullPath, json.icon)
        }
        const artwork = {
          id,
          folder: fullPath,
          json
        }
        return artwork
      } catch (e) {
        // unexpected error
        console.error(e)
      }
    }
    return null
  }
}

export default (ctx, inject) => {
  let instance = null
  const prop = {
    get() {
      if (instance === null) {
        instance = new Addons(ctx)
      }
      return instance
    }
  }

  Object.defineProperty(Vue.prototype, '$addons', prop)
  Object.defineProperty(ctx, '$addons', prop)
}
