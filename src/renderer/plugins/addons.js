import os from 'os'
import fs from 'fs-extra'
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

class Addons extends EventsBase {
  constructor (ctx) {
    super()

    this.AUTO_DOWNLOADED = {
      classic: {
        url: [
          'https://jcloisterzone.com/packages/classic/classic-6-5.9.0.jca',
          'https://mega.nz/file/HVJnFQaa#MIMfsuyvFopCeyWZZTcotXQcMpycHqA5UzHE4Fa1RFU'
        ],
        version: 6,
        sha256: '26b1fc8edc37c9df162b6b5a74164c6ba09951e450df7b62f2568c2db03327b0'
      }
    }

    this.ctx = ctx
    this.addons = []
    this.downloadableInitialized = 0
    this.downloadable = []
  }

  getDefaultArtworkUrl () {
    return this.AUTO_DOWNLOADED?.classic?.url
  }
  
  async getDownloadable() {
    if (this.downloadableInitialized == 0 ) {
      try {
        let url = `https://github.com/fancarpedia/FanCloisterZone/releases/download/v6.0.0-all/addons.json`
        const res = await fetch(url)
        if (res.status === 200) {
          const addons = await res.json()
          const appVersion = await ipcRenderer.invoke('get-app-version')
          const isDev = /-alpha|-beta|-rc/i.test(appVersion)
          const appVer = semver.coerce(appVersion)

          this.downloadable = addons.addons
          .map(addon => {
            const compatibleVersions = addon.versions.filter(v => {
              const fromVersion = isDev ? (v.devFromVersion ?? (v.fromVersion ?? null)) : (v.fromVersion ?? null)
              const fromOk = fromVersion ? semver.gte(appVer, semver.coerce(fromVersion)) : true
              const toVersion = isDev ? (v.devToVersion ?? (v.toVersion ?? null)) : (v.toVersion ?? null)
              const toOk = toVersion ? semver.lt(appVer, semver.coerce(toVersion)) : true // exclusive upper bound
              return fromOk && toOk
            })
            if (compatibleVersions.length > 0) {
              return { ...addon, versions: compatibleVersions }
            }
            return null
          })
          .filter(a => a !== null)
        }
        this.downloadableInitialized = 1
      } catch(err) {
        // No internet?
      }
    }
    return this.downloadable
  }

  async loadAddons () {
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
            addon.removable = removable && id !== 'classic'
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

    this.ctx.app.store.commit('hasClassicAddon', !!installedAddons.find(a => a.id === 'classic' && !a.error))

    this.addons = sortBy(installedAddons, ['removable', 'id'])
    this.ctx.app.store.commit('addonsLoaded')
  }

  async mkAddonsFolder () {
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
    let downloadPromise
    if (versionDefinition.provider === 'mega') {
      const file = File.fromURL(versionDefinition.url)
      downloadPromise = new Promise((resolve, reject) => {
        file
        .download()
        .pipe(fs.createWriteStream(downloadedPath))
        .on('error', reject)
        .on('finish', resolve)
      })
    } else if (versionDefinition.provider === 'https') {
      const res = await fetch(versionDefinition.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      downloadPromise = new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(downloadedPath)
        res.body.pipe(fileStream)
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      })
    } else {
      throw new Error(`Unknown provider: ${versionDefinition.provider}`)
    }

    await downloadPromise

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

  downloadFromMega (link, zipName, file, resolve, reject) {
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
        .pipe(file)
        .on('error', function (err) {
          console.error(err)
          fs.unlink(zipName, unlinkErr => {
            console.warn(unlinkErr)
          })
          reject(err.message)
        })
        .on('finish', function () {
          file.close(resolve)
        })
    } catch (error) {
      console.error(error)
      fs.unlink(zipName, unlinkErr => {
        console.warn(unlinkErr)
      })
      reject(error.message)
    }
  }

  async install (filePath) {
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

  async uninstall (addon) {
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

  async urlExists (url) {
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

  async checkMegaFile (url) {
    try {
      const file = File.fromURL(url)
      await file.loadAttributes()
      return true
    } catch (error) {
      return false
    }
  }

  async updateOutdatedClassic (installedAddons) {
    const classicArtwork = installedAddons.find(({ id }) => id === 'classic')
    if (classicArtwork) {
      if (!classicArtwork.outdated && !classicArtwork.error) {
        //
        return
      }
      installedAddons.splice(installedAddons.indexOf(classicArtwork), 1)
    }

    const links = this.getDefaultArtworkUrl()
    let link = null

    for (let i = 0; i < links.length; i++) {
      try {
        const exists = await this.urlExists(links[i])
        if (exists) {
          link = links[i]
          break
        }
      } catch (error) {
        continue
      }
    }

    this.ctx.app.store.commit('download', {
      name: 'classic.jca',
      description: 'Downloading classic artwork',
      progress: null,
      size: null,
      link
    })

    const addonsFolder = await this.mkAddonsFolder()
    const zipName = path.join(addonsFolder, 'classic.jca')
    try {
      if ((await fs.promises.stat(zipName)).isFile()) {
        await fs.promises.unlink(zipName)
      }
    } catch {
      // ignore
    }
    const file = fs.createWriteStream(zipName)
	try {
	  await new Promise((resolve, reject) => {
	    if (link.includes('mega.nz')) {
	      // Download from Mega.nz
	      this.downloadFromMega(link, zipName, file, resolve, reject)
	    } else {
	      // Download via HTTPS
	      let downloadedBytes = 0
	      const agent = new https.Agent({ rejectUnauthorized: false })
	      https.get(link, { agent }, response => {
	        const total = parseInt(response.headers['content-length'])
	        this.ctx.app.store.commit('downloadSize', total)
	        response.on('data', chunk => {
	          downloadedBytes += chunk.length
	          this.ctx.app.store.commit('downloadProgress', downloadedBytes)
	        })
	        response.pipe(file)
	        file.on('finish', function () {
	          file.close(resolve)
	        })
	      }).on('error', function (err) {
	        console.error(err)
	        fs.unlink(zipName, unlinkErr => {
	          console.warn(unlinkErr)
	        })
	        reject(err.message)
	      })
	    }
	  })
	} catch (e) {
	  this.ctx.app.store.commit('download', null)
	  return
	}
    const checksum = sha256File(zipName)
    if (checksum !== this.AUTO_DOWNLOADED.classic.sha256) {
      console.log('classic.jca checksum mismatch ' + checksum)
      this.ctx.app.store.commit('download', {
        name: 'classic.jca',
        description: 'Error: Downloaded file has invalid checksum',
        progress: 0,
        size: this.AUTO_DOWNLOADED.classic.size,
        link
      })
      await fs.promises.unlink(zipName)
    } else {
      console.log('classic.jca downloaded. sha256: ' + checksum)
      if (classicArtwork?.outdated) {
        console.log('Removing outdated artwork ' + classicArtwork.folder)
        await fs.promises.rmdir(classicArtwork.folder, { recursive: true })
      }
      await fs.createReadStream(zipName)
        .pipe(unzipper.Extract({ path: addonsFolder }))
        .promise()
      await fs.promises.unlink(zipName)
      this.ctx.app.store.commit('download', null)
    }

    const fullPath = path.join(addonsFolder, 'classic')
    const artwork = await this._readAddon('classic', fullPath)

    installedAddons.unshift(artwork)
  }

  async updateOutdatedAddons () {
    const installedAddons = this.addons
    const downloadable = await this.getDownloadable()

	let updated = false

    for (const installed of installedAddons) {
        const addon = installed.id
        const available = downloadable.find(({ key }) => key === addon)
        
        if (!available) continue

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

  findMissingAddons (required) {
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

  async _readAddon (id, fullPath) {
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
        const addon = {
          id,
          title: json.title,
          folder: fullPath,
          json,
          remote: this.AUTO_DOWNLOADED[id] || null
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

  async _readArtwork (id, fullPath) {
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
    get () {
      if (instance === null) {
        instance = new Addons(ctx)
      }
      return instance
    }
  }

  Object.defineProperty(Vue.prototype, '$addons', prop)
  Object.defineProperty(ctx, '$addons', prop)
}
