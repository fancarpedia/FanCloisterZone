import { app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import electronLogger from 'electron-log'
import { compareVersions } from 'compare-versions'
import fetch from 'node-fetch'
import { marked } from 'marked'

let diffDown = {
  percent: 0,
  bytesPerSecond: 0,
  total: 0,
  transferred: 0
}
let diffDownHelper = {
  startTime: 0,
  lastTime: 0,
  lastSize: 0
}

let win = null
let updateInfo = null

/**
 * Get the newest release according to channel and SemVer rules
 * @param {string} channel - 'stable' | 'beta' | 'alpha'
 * @param {string} currentVersion - app.getVersion()
 */
async function getLatestReleaseByChannel(channel, currentVersion) {
  const res = await fetch('https://api.github.com/repos/fancarpedia/FanCloisterZone/releases') /* Fan Edition */
  const releases = await res.json()
  const parsed = releases
    .filter(r => !r.draft)
    .map(r => {
      function getAsset(ext) {
        if (!r.assets || !Array.isArray(r.assets)) return null;
        let found = r.assets.find(function(a) {
          return a.name && a.name.endsWith(ext);
        });
        return found ? found.browser_download_url : null;
      }

      return {
        version: r.tag_name.replace(/^v/, ''),
        prerelease: /-/.test(r.tag_name),
        alpha: /-alpha/i.test(r.tag_name),
        beta: /-beta/i.test(r.tag_name),
        rc: /-rc/i.test(r.tag_name),
        assetUrl: {
          exe: getAsset('.exe'),
          dmg: getAsset('.dmg'),
          appImage: getAsset('.AppImage')
        },
        releaseNotes: (r.body ? marked.parse(r.body || '') : r.tag_name) + ' ' + channel
      }
    })

  parsed.sort((a, b) => compareVersions(b.version, a.version))

  const pickNewer = predicate =>
    parsed.find(v => predicate(v) && compareVersions(v.version, currentVersion) > 0) || null

  let candidate = null

  switch (channel) {
    case 'beta':
      candidate =
        pickNewer(v => !v.prerelease || v.rc || v.beta ) ||       // stable, rc or beta
        pickNewer(v => v.alpha)                // alpha fallback
      break

    case 'dev':
      candidate = parsed.find(v => compareVersions(v.version, currentVersion) > 0) || null
      break

    case 'stable':
    default:
      candidate =
        pickNewer(v => !v.prerelease) ||       // stable
        pickNewer(v => v.rc || v.beta) ||      // rc / beta fallback
        pickNewer(v => v.alpha)                // alpha fallback
      break
  }
  return candidate
}

export default function (settings, appVersion) {
  // https://gist.github.com/the3moon/0e9325228f6334dabac6dadd7a3fc0b9
  electronLogger.hooks.push((msg, transport) => {
    if (transport !== electronLogger.transports.console) {
      return msg
    }

    let match = /Full: ([\d,.]+) ([GMKB]+), To download: ([\d,.]+) ([GMKB]+)/.exec(
      msg.data[0]
    )
    if (match) {
      let multiplier = 1
      if (match[4] === 'KB') multiplier *= 1024
      if (match[4] === 'MB') multiplier *= 1024 * 1024
      if (match[4] === 'GB') multiplier *= 1024 * 1024 * 1024

      diffDown = {
        percent: 0,
        bytesPerSecond: 0,
        total: Number(match[3].split(',').join('')) * multiplier,
        transferred: 0
      }
      diffDownHelper = {
        startTime: Date.now(),
        lastTime: Date.now(),
        lastSize: 0
      }
      return msg
    }

    match = /download range: bytes=(\d+)-(\d+)/.exec(msg.data[0])
    if (match) {
      const currentSize = Number(match[2]) - Number(match[1])
      const currentTime = Date.now()
      const deltaTime = currentTime - diffDownHelper.startTime

      diffDown.transferred += diffDownHelper.lastSize
      diffDown.bytesPerSecond = Math.floor(
        (diffDown.transferred * 1000) / deltaTime
      )
      diffDown.percent = (diffDown.transferred * 100) / diffDown.total

      diffDownHelper.lastSize = currentSize
      diffDownHelper.lastTime = currentTime
      win.webContents.send('update-progress', diffDown)
      return msg
    }
    return msg
  })

  ipcMain.on('do-update', async () => {
    await autoUpdater.downloadUpdate()
    if (win) {
      win.webContents.send('update-progress', { percent: 100 })
    }
    autoUpdater.quitAndInstall()
  })
  // const log = require('electron-log')
  // log.transports.file.level = 'debug'
  // autoUpdater.logger = log
  autoUpdater.autoDownload = false
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'fancarpedia', /* Fan Edition */
    repo: 'FanCloisterZone' /* Fan Edition */
  })
  // ---- Check for updates ----
  const channel = settings.devChannel ? settings.devChannel : 'stable'
  
  function trySendUpdate() {
    if (win && updateInfo) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('app-update', updateInfo)
      })
    }
  }
  getLatestReleaseByChannel(channel, appVersion)
    .then(result => {
      if (!result) return
      updateInfo = result
      trySendUpdate()
    })
    .catch(err => console.error(err))
  
  return {
    winCreated (_win) {
      win = _win
      trySendUpdate()
    },
    winClosed (_win) { win = null }
  }
}
