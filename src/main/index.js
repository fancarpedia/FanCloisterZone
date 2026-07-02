/* globals INCLUDE_RESOURCES_PATH */
import path from 'path'

import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { dialog as dialogElectron } from 'electron'
import { autoUpdater } from 'electron-updater'
import electronLogger from 'electron-log'
import fs from 'fs'

import settings, { getSettingsSync } from './settings'
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
    s = { role: 'main', intent: null, gameId: null, key: null, setup: null, progress: null, active: null, hasLocalGame: false, isForceClosing: false }
    winState.set(wc.id, s)
  }
  return s
}

// --- open game-windows registry (for the lobby's "open windows" list) -----------------------------
// A window counts as a listable game window once it is a 'game' window AND has been handed a launch
// intent (so the hidden pre-warmed game window, which has no intent yet, is excluded).
function isListableGameState (st) {
  return !!(st && st.role === 'game' && st.intent != null)
}

function isLocalIntent (intent) {
  const kind = intent && intent.kind
  return kind === 'new-local' || kind === 'load' || kind === 'load-setup'
}

// Best-effort English fallback title; the renderer localises via intentKind, but keep a readable
// label here for any window whose kind we don't recognise.
function deriveWindowTitle (st) {
  const intent = st.intent || {}
  const payload = intent.payload || {}
  switch (intent.kind) {
    case 'new-local': return payload.ai ? 'Local game vs AI' : 'Local game'
    case 'load':
    case 'load-setup': return payload.file ? `Local game — ${path.basename(payload.file)}` : 'Local game'
    case 'create-online':
    case 'join-online': return 'Online game'
    default: return st.gameId ? `Game ${st.gameId}` : 'Game'
  }
}

function findWindowByWcId (id) {
  return BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.id === id) || null
}

function serializeGameWindows () {
  const out = []
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    const st = winState.get(win.webContents.id)
    if (!isListableGameState(st)) continue
    out.push({
      id: win.webContents.id,
      gameId: st.gameId || null,
      key: st.key || null,
      setup: st.setup || null,
      progress: st.progress || null,
      active: st.active || null,
      intentKind: (st.intent && st.intent.kind) || null,
      isLocal: isLocalIntent(st.intent),
      title: deriveWindowTitle(st)
    })
  }
  return out
}

// Push the current list of open game windows to every window (lobby + game windows).
function broadcastGameWindows () {
  const list = serializeGameWindows()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('game-windows.changed', list)
  }
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

// --- Windows taskbar grouping --------------------------------------------------------------------
// Windows groups taskbar buttons by AppUserModelID (AUMID). We support two modes (see the
// "Windows taskbar" system setting):
//   'separate' (default) — give each window a UNIQUE AUMID so every window is its own taskbar button
//   'grouped'            — all windows share one AUMID (grouped under a single button); the active
//                          game window is raised on top when it becomes that player's turn
const TASKBAR_APP_ID = 'com.jcloisterzone.fan'
app.setAppUserModelId(TASKBAR_APP_ID)

function getTaskbarMode () {
  return getSettingsSync().windowsTaskbarMode === 'grouped' ? 'grouped' : 'separate'
}

// Apply the current taskbar mode to a single window (Windows only).
function applyWindowTaskbar (win, mode = getTaskbarMode()) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return
  const appId = mode === 'grouped'
    ? TASKBAR_APP_ID
    : `${TASKBAR_APP_ID}.w${win.webContents.id}` // unique per window → separate taskbar buttons
  try {
    win.setAppDetails({ appId })
  } catch (e) {
    console.log('setAppDetails failed', e)
  }
}

// Re-apply the taskbar mode to every open window (used when the setting changes).
function applyTaskbarModeAll (mode = getTaskbarMode()) {
  for (const w of BrowserWindow.getAllWindows()) applyWindowTaskbar(w, mode)
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

function buildWindow ({ role = 'main', hidden = false } = {}) {
  const win = new BrowserWindow({
    height: 600,
    width: 1000,
    show: !hidden,
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
  applyWindowTaskbar(win) // set this window's taskbar grouping per the current setting

  // Forward renderer console (esp. uncaught render errors) to the main-process stdout, so a
  // crash that closes the window too fast to read in DevTools is still visible in the terminal.
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // 2 = warning, 3 = error
      console.log(`[renderer ${wcId}] ${level === 3 ? 'ERROR' : 'WARN'}: ${message}  (${sourceId}:${line})`)
    }
  })
  win.webContents.on('render-process-gone', (event, details) => {
    console.log(`[renderer ${wcId}] render-process-gone:`, JSON.stringify(details))
  })
  win.webContents.on('unresponsive', () => console.log(`[renderer ${wcId}] unresponsive`))

  win.loadURL(process.env.NODE_ENV === 'development' ? process.env.DEV_SERVER_URL : 'app://./index.html')

  if (!hidden) {
    win.once('ready-to-show', () => {
      win.maximize()
      modules.forEach(m => m.winCreated(win))
    })
  }

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
    broadcastGameWindows() // a window vanished → refresh the lobby's open-windows list
    // Clean up warm window reference if this was the warm window
    if (warmWin === win) {
      warmWin = null
      warmWinReady = false
    }
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
  const win = buildWindow({ role: 'main' })
  // Pre-warm one hidden game window so the first "New Game" click is near-instant.
  spawnWarmWindow()
  return win
}

// --- warm window pool ----------------------------------------------------------------------------
// One hidden game window is kept booted in the background. When the user opens a game we hand it
// the intent immediately (or fall back to a fresh window if warmup isn't done yet).
let warmWin = null      // BrowserWindow | null
let warmWinReady = false // true once the warm window's renderer has finished mounting

function spawnWarmWindow () {
  if (warmWin && !warmWin.isDestroyed()) return // already warming or ready
  warmWin = buildWindow({ role: 'game', hidden: true })
  warmWinReady = false
}

// Open a dedicated window for one game. Always opens a NEW window — joining an online game that is
// already open in another window opens another one (no focus-existing / de-dupe).
function openGameWindow (intent) {
  let win
  if (warmWin && !warmWin.isDestroyed()) {
    // Claim the warm window (ready or still loading)
    win = warmWin
    warmWin = null
    const st = stateFor(win.webContents)
    st.intent = intent || null
    if (warmWinReady) {
      // Already booted — deliver intent immediately and show
      win.webContents.send('game-window.init', { role: 'game', intent: intent || null })
      win.maximize()
      win.show()
    }
    // else: still loading — game-window.ready handler will deliver intent + show it
    warmWinReady = false
    spawnWarmWindow() // start warming the next one
  } else {
    win = buildWindow({ role: 'game' })
    const st = stateFor(win.webContents)
    st.intent = intent || null
  }
  const gameId = intent && intent.gameId
  if (gameId) stateFor(win.webContents).gameId = gameId
  broadcastGameWindows() // a new game window appeared (intent set) → refresh the list
  return win
}

// --- game-window IPC -----------------------------------------------------------------------------
// A game-window renderer signals it is ready → hand it its launch intent.
ipcMain.on('game-window.ready', (event) => {
  const wc = event.sender
  const st = stateFor(wc)

  // Warm window not yet claimed: just mark it ready and wait silently for openGameWindow to claim it.
  if (warmWin && !warmWin.isDestroyed() && warmWin.webContents.id === wc.id) {
    warmWinReady = true
    return
  }

  // Claimed warm window that fired ready AFTER being claimed (still hidden): deliver intent + show.
  // Regular new window: deliver intent (window is already visible via ready-to-show).
  wc.send('game-window.init', { role: st.role, intent: st.intent })
  const win = BrowserWindow.fromWebContents(wc)
  if (win && !win.isDestroyed() && !win.isVisible()) {
    win.maximize()
    win.show()
  }
  broadcastGameWindows() // window is now shown with its intent → refresh the list
})

// A renderer (lobby, or test runner) asks to open/focus a game in its own window.
ipcMain.handle('open-game-window', (event, intent) => {
  openGameWindow(intent)
})

// A game window reports the gameId it ended up running (used for the title/debug indicator).
ipcMain.on('game-window.set-gameid', (event, gameId) => {
  stateFor(event.sender).gameId = gameId || null
  broadcastGameWindows() // gameId changed → refresh the list label
})

// A game window reports its online game key (e.g. "ABC-123") so the lobby can show it.
ipcMain.on('game-window.set-key', (event, key) => {
  stateFor(event.sender).key = key || null
  broadcastGameWindows() // key changed → refresh the list
})

// A game window reports its active player ({ slot, isMe }) so the lobby can colour/blink the bullet.
ipcMain.on('game-window.set-active', (event, active) => {
  const st = stateFor(event.sender)
  const wasMine = !!(st.active && st.active.isMe)
  st.active = active || null
  broadcastGameWindows() // active player changed → refresh the bullet

  // Grouped taskbar mode: when this game becomes my turn, raise its window to the top of the
  // stack (z-order only, no focus stealing) so the active game surfaces above the others.
  if (
    process.platform === 'win32' &&
    getTaskbarMode() === 'grouped' &&
    active && active.isMe && !wasMine
  ) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.moveTop()
  }
})

// The "Windows taskbar" setting changed in the renderer → re-apply grouping to all windows now.
ipcMain.handle('taskbar.set-mode', (event, mode) => {
  applyTaskbarModeAll(mode === 'grouped' ? 'grouped' : 'separate')
})

// A game window reports its setup ({ sets, elements }) so the lobby can show a setup overview.
ipcMain.on('game-window.set-setup', (event, setup) => {
  stateFor(event.sender).setup = setup || null
  broadcastGameWindows() // setup changed → refresh the list
})

// A game window reports its tile progress ({ used, total }) so the lobby can show placed/total tiles.
ipcMain.on('game-window.set-progress', (event, progress) => {
  stateFor(event.sender).progress = progress || null
  broadcastGameWindows() // progress changed → refresh the list
})

// --- open-windows list IPC -----------------------------------------------------------------------
// The lobby pages (index/online) query and act on the set of open game windows.
ipcMain.handle('list-game-windows', () => serializeGameWindows())

// A renderer asks for its own webContents id so it can exclude itself from the list.
ipcMain.handle('get-my-window-id', (event) => event.sender.id)

// Bring a game window to the front.
ipcMain.on('focus-game-window', (event, id) => {
  const win = findWindowByWcId(id)
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
})

// Close a game window from the list (goes through the window's own close guard).
ipcMain.on('close-game-window', (event, id) => {
  const win = findWindowByWcId(id)
  if (win) win.close()
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
