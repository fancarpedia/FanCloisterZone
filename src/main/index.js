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
import dialog from './modules/dialog'
import updater from './modules/updater'
import winevents from './modules/winevents'
import settingsWatch from './modules/settingsWatch'
import localServer from './modules/localServer'
import installer from './modules/installer'

import dotenv from 'dotenv'
import RPC from 'discord-rpc'

dotenv.config()  // Load environment variables

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

  win.on('close', (event) => {
    if (hasLocalGame) {
      event.preventDefault()
      if (!isForceClosing) {
        isForceClosing = true

        const choice = dialogElectron.showMessageBoxSync(win, {
          type: 'warning',
          buttons: [
            'Resign and Close',
            'Continue playing'
          ],
          defaultId: 0,
          cancelId: 1,
          title: 'Unfinished Local Game',
          message: 'You have an unfinished local game. If you close the app window, you will resign and lose your progress in this game.',
        })
      
        isForceClosing = false
        if (choice === 0) {
          hasLocalGame = false
          win.close()
        }
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

// // Quit when all windows are closed.
app.on('window-all-closed', function () {
  // console.log('window-all-closed emitted')

  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform !== 'darwin') app.quit()

  // fpr now quit it alsi on Mac
  app.quit()
})

const discordClientId = process.env.DISCORD_CLIENT_ID
let discordRpc

if (!discordClientId) {
  console.warn('DISCORD_CLIENT_ID not set in .env, Discord Rich Presence disabled')
} else {
  try {
    discordRpc = new RPC.Client({ transport: 'ipc' })
    RPC.register(discordClientId)

    discordRpc.on('ready', () => {
      console.log('Discord Rich Presence is active!')

      // Initial status
      discordRpc.setActivity({
        details: 'FanCloisterZone',
        state: 'Playing',
        startTimestamp: new Date(),
        largeImageKey: 'game_icon', // Discord app asset
        largeImageText: 'FanCloisterZone',
        buttons: [{ label: 'Join Game', url: 'https://github.com/fancarpedia/FanCloisterZone/releases' }]
      })
    })
    discordRpc.login({ clientId: discordClientId }).catch(console.error)
  } catch (e) {
    console.error('Discord RPC initialization failed:', e)
  }
}

// Optional: helper function to update status dynamically
export function updateDiscordStatus(details, state) {
  if (!discordRpc) return
  discordRpc.setActivity({
    details,
    state,
    startTimestamp: new Date(),
    largeImageKey: 'game_icon',
    largeImageText: 'FanCloisterZone'
  })
}
