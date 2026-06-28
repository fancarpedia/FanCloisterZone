/* globals INCLUDE_RESOURCES_PATH */
import path from 'path'

import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { dialog as dialogElectron } from 'electron'
import { autoUpdater } from 'electron-updater'
import electronLogger from 'electron-log'
import fs from 'fs'

import settings from './settings'
import menu from './modules/menu'
import theme from './modules/theme'
import dialog, { showUnfinishedGameDialog } from './modules/dialog'
import updater from './modules/updater'
import winevents from './modules/winevents'
import settingsWatch from './modules/settingsWatch'
import localServer from './modules/localServer'
import installer from './modules/installer'

import RPC from 'discord-rpc'

autoUpdater.logger = electronLogger
autoUpdater.logger.transports.file.level = 'info'

const modules = []
const dialogLocks = new WeakMap()

function getAppVersion() {
  if (process.env.NODE_ENV === 'development') {
    // Read version from your package.json in development
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version
  }
  return app.getVersion()
}
// Per-window state, keyed by webContents.id. Each window is either the 'main' lobby window or a
// dedicated 'game' window (one game per window). Every launch opens a new window — no de-duping.
const winState = new Map() // webContents.id -> { role, intent, gameId, hasLocalGame, isForceClosing }

function stateFor (wc) {
  let s = winState.get(wc.id)
  if (!s) {
    s = { role: 'main', intent: null, gameId: null, hasLocalGame: false, isForceClosing: false }
    winState.set(wc.id, s)
  }
  return s
}

ipcMain.handle("get-app-version", () => {
  return getAppVersion()
})

ipcMain.on('set-local-game', (event, value) => {
  stateFor(event.sender).hasLocalGame = value
})

ipcMain.handle('open-load-game-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true }

  // Prevent multiple dialogs per window
  if (dialogLocks.get(win)) {
    win.focus();
    return { canceled: true }
  }

  dialogLocks.set(win, true)

  try {
    return await dialogElectron.showOpenDialog(win, {
      ...options,
      modal: true,
      parent: win
    })
  } finally {
    dialogLocks.set(win, false);
    if (!win.isDestroyed()) win.focus()
  }
})

function generateInstanceId() {
    // Use timestamp + process ID so each instance is unique
    return `com.myapp.instance.${Date.now()}.${process.pid}`
}
app.setAppUserModelId(generateInstanceId()) // Prevent grouping app icons

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

function buildWindow ({ role = 'main' } = {}) {
  const win = new BrowserWindow({
    height: 600,
    width: 1000,
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
    webPreferences: {
      zoomFactor: 1,
      webSecurity: false,
      // keep timers/JS running at full speed when the window is unfocused or hidden,
      // otherwise Chromium throttles background renderers and the Test Runner (timers,
      // run loop) stalls until the window regains focus
      backgroundThrottling: false,
      nodeIntegration: true, // allow loading modules via the require () function
      contextIsolation: false,
      additionalArguments: [
        '--user-data=' + app.getPath('userData'),
        '--app-version=' + getAppVersion(),
        // The renderer reads this to decide whether it is the lobby ('main') or a dedicated
        // single-game window ('game'); a game window asks for its intent via game-window.ready.
        '--window-role=' + role
      ],
      devTools: !process.env.SPECTRON // disable on e2e test environment
    }
  })

  const wcId = win.webContents.id
  stateFor(win.webContents).role = role

  win.loadURL(process.env.NODE_ENV === 'development' ? process.env.DEV_SERVER_URL : 'app://./index.html')

  win.once('ready-to-show', () => {
    win.maximize()
    modules.forEach(m => m.winCreated(win))
  })

  win.on('close', async (event) => {
    const st = winState.get(wcId)
    if (st && st.hasLocalGame && !st.isForceClosing) {
      event.preventDefault()
      st.isForceClosing = true

      const choice = await showUnfinishedGameDialog(win)

      st.isForceClosing = false
      if (choice === 0) {
        st.hasLocalGame = false
        win.destroy() // Force close the window
      }
    }
  })

  win.on('closed', ev => {
    modules.forEach(m => m.winClosed(win))
    const st = winState.get(wcId)
    winState.delete(wcId)
    // Closing the lobby quits the app (and with it any remaining game windows).
    if (st && st.role === 'main') {
      app.quit()
    } else {
      // When a game window closes, bring the main (lobby) window back into focus.
      const mainWin = BrowserWindow.getAllWindows().find(w => {
        const s = winState.get(w.webContents.id)
        return s && s.role === 'main'
      })
      if (mainWin && !mainWin.isDestroyed()) mainWin.focus()
    }
  })

  return win
}

function createWindow () {
  return buildWindow({ role: 'main' })
}

// Open a dedicated window for one game. Always opens a NEW window — joining an online game that is
// already open in another window opens another one (no focus-existing / de-dupe).
function openGameWindow (intent) {
  const win = buildWindow({ role: 'game' })
  const st = stateFor(win.webContents)
  st.intent = intent || null
  const gameId = intent && intent.gameId
  if (gameId) st.gameId = gameId // tracked for the title/debug indicator only
  return win
}

// --- game-window IPC -----------------------------------------------------------------------------
// A game-window renderer signals it is ready → hand it its launch intent.
ipcMain.on('game-window.ready', (event) => {
  const st = stateFor(event.sender)
  event.sender.send('game-window.init', { role: st.role, intent: st.intent })
})

// A renderer (lobby, or test runner) asks to open/focus a game in its own window.
ipcMain.handle('open-game-window', (event, intent) => {
  openGameWindow(intent)
})

// A game window reports the gameId it ended up running (used for the title/debug indicator).
ipcMain.on('game-window.set-gameid', (event, gameId) => {
  stateFor(event.sender).gameId = gameId || null
})

// In-game "close/leave" → close just this window (the renderer has already confirmed and cleaned up).
// Clear hasLocalGame so the main-process close guard doesn't show a second confirmation dialog.
ipcMain.on('close-self-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && !win.isDestroyed()) {
    stateFor(event.sender).hasLocalGame = false
    win.close()
  }
})

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  // console.log('app is ready')
  // protocol.registerFileProtocol('file', (request, callback) => {
  //   const pathname = request.url.replace('file:///', '')
  //   callback(pathname)
  // })

  settings().then(settings => {
    // console.log('creating modules')
    modules.push(settingsWatch(settings))
    modules.push(theme(settings))
    modules.push(menu(settings))
    modules.push(dialog(settings))
    modules.push(winevents(settings))
    modules.push(localServer(settings))
    const appVersion = getAppVersion()
    modules.push(updater(settings, appVersion))
    modules.push(installer())

    if (process.env.NODE_ENV === 'production') {
      modules.push(updater(settings))
    }

    createWindow()
  })
})

app.on('activate', () => {
  // currently not used, because app us quit when main vindow is closed
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  console.log('window-all-closed emitted')

  // Always quit the app when all windows are closed
  if (process.platform === 'win32') {
    // Force Electron shutdown (bypasses updater / installer hooks)
    app.exit(0)
  } else {
    app.quit()
  }
})

app.on('before-quit', () => {
  autoUpdater.removeAllListeners()
  // Clean up Discord RPC connection
})

let discordClientId = null
let discordRpc = null

// Destroy Discord RPC
function destroyRpc() {
  if (discordRpc) {
    try {
      discordRpc.removeAllListeners()
      discordRpc.destroy();
    } catch {} 
  }
}

// Init Discord RPC asynchronously
async function initDiscordRpc() {
  if (!discordRpc) {
    if (process.env.NODE_ENV === 'production') {
      try {
        const { DISCORD_CLIENT_ID } = await import('./config/discord.js')
        discordClientId = DISCORD_CLIENT_ID
      } catch (e) {
        console.warn('Failed to load Discord config:', e)
      }
    }

    if (!discordClientId) {
      console.warn('DISCORD_CLIENT_ID not set, Discord Rich Presence disabled')
      return
    }

    try {
      // Create the RPC client
      discordRpc = new RPC.Client({ transport: 'ipc' })
      RPC.register(discordClientId)

      // Login to Discord
      discordRpc.login({ clientId: discordClientId }).catch(console.error)

    // Once ready, set initial status
      discordRpc.on('ready', () => {
        console.log('Discord Rich Presence is active!')
        setDiscordActivity({
          details: 'FanCloisterZone',
          state: 'Playing'
        })
      })
    } catch (e) {
      console.error('Discord RPC initialization failed:', e)
    }
  } else {
    setDiscordActivity({
      details: 'FanCloisterZone',
      state: 'Playing'
    })
  }
}

// Call the async function
initDiscordRpc()

/**
 * Helper function to set or update Discord Rich Presence
 * @param {Object} options - { details: string, state: string, largeImageKey?, largeImageText? }
 */
export function setDiscordActivity({ details, state, largeImageKey = 'game_icon', largeImageText = 'FanCloisterZone' }) {
  if (!discordRpc) return
  try {
    discordRpc.setActivity({
      details,
      state,
      startTimestamp: new Date(),
      largeImageKey,
      largeImageText,
      buttons: [{ label: 'Join Game', url: 'https://github.com/fancarpedia/FanCloisterZone/releases' }]
    })
  } catch (err) {
    console.error('Failed to set Discord Rich Presence:', err)
  }
}

powerMonitor.on('lock-screen', () => {
  try {
    discordRpc.clearActivity().catch(console.error)
  } catch {}
})

powerMonitor.on('unlock-screen', () => {
  try {
    initDiscordRpc()
  } catch (e){}
})

powerMonitor.on('suspend', () => {
  console.log('System is going to sleep mode/hibernation');

  try {
    discordRpc.clearActivity().catch(console.error)
  } catch (e){}
})

powerMonitor.on('resume', () => {
  console.log('System is going to resume');

  try {
    initDiscordRpc()
  } catch (e){}
})
