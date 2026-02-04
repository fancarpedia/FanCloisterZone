/* globals INCLUDE_RESOURCES_PATH */
import path from 'path'

import { app, BrowserWindow, ipcMain } from 'electron'
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
let hasLocalGame = false
let isForceClosing = false

ipcMain.handle("get-app-version", () => {
  return getAppVersion()
})

ipcMain.on('set-local-game', (_, value) => {
  hasLocalGame = value
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

async function createWindow () {
  const win = new BrowserWindow({
    height: 600,
    width: 1000,
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
    webPreferences: {
      zoomFactor: 1,
      webSecurity: false,
      nodeIntegration: true, // allow loading modules via the require () function
      contextIsolation: false,
      additionalArguments: [
        '--user-data=' + app.getPath('userData'),
        '--app-version=' + getAppVersion()
      ],
      devTools: !process.env.SPECTRON // disable on e2e test environment
    }
  })

  // console.log('BrowserWindow created')
  win.loadURL(process.env.NODE_ENV === 'development' ? process.env.DEV_SERVER_URL : 'app://./index.html')
  // console.log('BrowserWindow loadURL called')

  win.once('ready-to-show', () => {
    // console.log('BrowserWindow ready to show')
    win.maximize()

    // console.log('winCreated notification for modules')
    modules.forEach(m => m.winCreated(win))
  })

  win.on('close', async (event) => {
    if (hasLocalGame && !isForceClosing) {
      event.preventDefault()
      isForceClosing = true

      const choice = await showUnfinishedGameDialog()
    
      isForceClosing = false
      if (choice === 0) {
        hasLocalGame = false
        win.destroy() // Force close the window
      }
    }
  })
  
  win.on('closed', ev => {
    // console.log("WIN CLOSED")
    modules.forEach(m => m.winClosed(win))
  })

  return win
}

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
  if (discordRpc) {
    try {
      discordRpc.removeAllListeners()
      discordRpc.destroy();
    } catch {} 
  }
})

let discordClientId = null
let discordRpc = null

// Initialize Discord RPC asynchronously
async function initializeDiscordRpc() {
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
}

// Call the async function
initializeDiscordRpc()

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
