import { Menu, ipcMain, BrowserWindow, app } from 'electron'
import { getSettings } from '../settings'

let _win
let menu

// Per-window menu state, keyed by webContents.id.
// Each window sends update-menu / set-menu-checked for its own context (lobby vs. in-game).
// On focus change we re-apply the focused window's state so the global menu always reflects
// the window the user is actually looking at.
const perWinEnabled = new Map() // wcId -> { id: enabled, ... }
const perWinChecked = new Map() // wcId -> { id: checked, ... }
const winWcId = new Map()       // win -> wcId (cached so winClosed never touches destroyed webContents)

// Baseline enabled state: all game-specific items are disabled by default.
// Each window overrides this via update-menu.
const DEFAULT_ENABLED = {
  'playonline-connect': false,
  'playonline-disconnect': false,
  'new-game': false,
  'join-game': false,
  'leave-game': false,
  'save-game': false,
  'load-game': false,
  'undo': false,
  'zoom-in': false,
  'zoom-out': false,
  'rotate': false,
  'toggle-history': false,
  'game-tiles': false,
  'game-farm-hints': false,
  'game-feature-hints': false,
  'game-potential-score': false,
  'game-setup': false,
  'dump-server': false,
  'theme-inspector': false,
  'save-for-test-runner': false,
  'save-for-test-runner-end-game': false
}

// checked state defaults — kept in sync with the renderer store per window
const DEFAULT_CHECKED = {
  'game-farm-hints': false,
  'game-feature-hints': false,
  'game-potential-score': false,
  'toggle-history': true
}

function applyWindowState (wcId) {
  const currentMenu = Menu.getApplicationMenu()
  if (!currentMenu) return

  const enabled = { ...DEFAULT_ENABLED, ...(perWinEnabled.get(wcId) || {}) }
  const checked = { ...DEFAULT_CHECKED, ...(perWinChecked.get(wcId) || {}) }

  Object.entries(enabled).forEach(([id, val]) => {
    const item = currentMenu.getMenuItemById(id)
    if (item) item.enabled = val
  })
  Object.entries(checked).forEach(([id, val]) => {
    const item = currentMenu.getMenuItemById(id)
    if (item) item.checked = val
  })
}

app.on('browser-window-focus', (_, win) => {
  if (!win || !win.webContents) return
  applyWindowState(win.webContents.id)
  applyDevToolsCheck(win)
})

function updateDevToolsCheck(win) {
  const currentMenu = Menu.getApplicationMenu()
  const item = currentMenu ? currentMenu.getMenuItemById('toggle-devtools') : null
  if (!item) return
  // Only update the checkbox when the window whose DevTools changed is currently focused.
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && focused === win) {
    item.checked = win.webContents.isDevToolsOpened()
  }
}

function applyDevToolsCheck(win) {
  const currentMenu = Menu.getApplicationMenu()
  const item = currentMenu ? currentMenu.getMenuItemById('toggle-devtools') : null
  if (item && win && !win.isDestroyed()) {
    item.checked = win.webContents.isDevToolsOpened()
  }
}

async function createMenu(win, messages) {
  const $t = key => messages[key.replace('menu.', '').replace('dev.', '')]
  const settings = await getSettings()

  // The application menu is global; route each command to the *focused* window so menu actions
  // hit whichever window (lobby or a specific game window) the user is currently looking at.
  const targetWin = () => BrowserWindow.getFocusedWindow() || win

  const isMac = process.platform === 'darwin'
  const sessionSubmenu = [
    { id: 'new-game', label: $t('menu.new-game') || 'New Game', accelerator: 'CommandOrControl+N', click() { targetWin().webContents.send('menu.new-game') } },
    { id: 'join-game', label: $t('menu.join-game') || 'Join Game', accelerator: 'CommandOrControl+J', click() { targetWin().webContents.send('menu.join-game') } },
    { type: 'separator' },
    { id: 'save-game', label: $t('menu.save-game') || 'Save Game', accelerator: 'CommandOrControl+S', click() { targetWin().webContents.send('menu.save-game') } },
    { id: 'load-game', label: [$t('menu.open-game') || 'Open Game', $t('menu.load-setup') || 'Load Setup'].join(' / '), accelerator: 'CommandOrControl+O', click() { targetWin().webContents.send('menu.load-game') } },
    { type: 'separator' },
    { id: 'settings', label: $t('menu.settings') || 'Settings', accelerator: 'CommandOrControl+,', click() { targetWin().webContents.send('menu.show-settings') } },
    { type: 'separator' },
    isMac ? { role: 'close', label: $t('menu.exit') } : { role: 'quit', label: $t('menu.exit') }
  ]

  const template = [
    {
      label: $t('menu.file') || 'File',
      submenu: sessionSubmenu
    },
    {
      label: $t('menu.online') || 'Online',
      submenu: [
        { id: 'playonline-connect', label: $t('menu.playonline-connect') || 'Play Online', accelerator: 'CommandOrControl+P', click() { targetWin().webContents.send('menu.playonline-connect') } },
        { id: 'playonline-disconnect', label: $t('menu.playonline-disconnect') || 'Disconnect', click() { targetWin().webContents.send('menu.playonline-disconnect') } },
      ]
    },
    {
      label: $t('menu.game') || 'Game',
      submenu: [
        { id: 'undo', label: $t('menu.undo') || 'Undo', accelerator: 'CommandOrControl+Z', click() { targetWin().webContents.send('menu.undo') } },
        { type: 'separator' },
        { id: 'leave-game', label: $t('menu.leave-game') || 'Leave Game', accelerator: 'CommandOrControl+W', click() { targetWin().webContents.send('menu.leave-game') } },
        { type: 'separator' },
        { id: 'game-setup', label: $t('menu.show-game-setup') || 'Show game setup', click() { targetWin().webContents.send('menu.game-setup') } },
        { type: 'separator' },
        { id: 'zoom-in', label: $t('menu.zoom-in') || 'Zoom In', accelerator: 'numadd', registerAccelerator: false, click() { targetWin().webContents.send('menu.zoom-in') } },
        { id: 'zoom-out', label: $t('menu.zoom-out') || 'Zoom Out', accelerator: 'numsub', registerAccelerator: false, click() { targetWin().webContents.send('menu.zoom-out') } },
        { id: 'rotate', label: $t('menu.rotate') || 'Rotate', accelerator: 'r', registerAccelerator: false, click() { targetWin().webContents.send('menu.rotate') } },
        { type: 'separator' },
        { id: 'game-tiles', label: $t('menu.tiles') || 'Tiles', click() { targetWin().webContents.send('menu.game-tiles') } },
        { id: 'game-farm-hints', label: $t('menu.farm-hints') || 'Farm Hints', accelerator: 'f', registerAccelerator: false, type: 'checkbox', checked: DEFAULT_CHECKED['game-farm-hints'], click() { targetWin().webContents.send('menu.game-farm-hints') } },
        { id: 'game-feature-hints', label: $t('menu.feature-hints') || 'Feature Hints', accelerator: 't', registerAccelerator: false, type: 'checkbox', checked: DEFAULT_CHECKED['game-feature-hints'], click() { targetWin().webContents.send('menu.game-feature-hints') } },
        { id: 'game-potential-score', label: $t('menu.potential-score') || 'Potential Final Score', type: 'checkbox', checked: DEFAULT_CHECKED['game-potential-score'], click() { targetWin().webContents.send('menu.game-potential-score') } },
        { id: 'toggle-history', label: $t('menu.toggle-history') || 'Toggle History', accelerator: 'h', registerAccelerator: false, type: 'checkbox', checked: DEFAULT_CHECKED['toggle-history'], click() { targetWin().webContents.send('menu.game-history') } }
      ]
    }, {
      label: $t('menu.help') || 'Help',
      submenu: [
        { label: ($t('menu.rules') || 'Rules') + ' (WikiCarpedia)', click() { targetWin().webContents.send('menu.rules') } },
        { label: ($t('menu.report-bug') || 'Report a bug'), click() { targetWin().webContents.send('menu.report-bug') } },
        { label: ($t('menu.discord') || 'Discord'), click() { targetWin().webContents.send('menu.discord') } },
        { type: 'separator' },
        { label: $t('menu.about') || 'About', click() { targetWin().webContents.send('menu.about') } }
      ]
    }
  ]

  if (settings.devMode) {
    const remoteEngineValue = 'localhost:9001'
    const toggleRemoteEngine = async () => {
      const currValue = (await getSettings()).enginePath
      targetWin().webContents.send('settings.update', { enginePath: currValue === remoteEngineValue ? null : remoteEngineValue })
    }

    // The renderer orchestrates the switch: it confirms if online games are open, closes them,
    // then broadcasts the change to EVERY window (shared setting) so they all reconnect.
    const toggleLocalPlayOnline = () => {
      targetWin().webContents.send('menu.toggle-local-play-online')
    }

    template.push({
      label: $t('dev.dev') || 'Dev',
      submenu: [
        {
          id: 'toggle-devtools',
          role: 'toggleDevTools',
          label: $t('dev.toggle-devtools') || 'Toggle DevTools',
          type: 'checkbox',
          checked: win.webContents.isDevToolsOpened()
        },
        { type: 'separator' },
        { id: 'remote-engine', label: $t('dev.use-remote-engine') || 'Use Remote Engine', type: 'checkbox', checked: settings.enginePath === remoteEngineValue, click() { toggleRemoteEngine() } },
        { id: 'local-play-online', label: $t('dev.use-local-play-online') || 'Use Local Play Online', type: 'checkbox', checked: !!settings.localPlayOnline, click() { toggleLocalPlayOnline() } },
        { id: 'dump-server', label: $t('dev.dump-hosted-game-server-state') || 'Dump Hosted Game Server State', click() { targetWin().webContents.send('menu.dump-server') } },
        { type: 'separator' },
        { id: 'test-runner', label: $t('dev.test-runner') || 'Test Runner', click() { targetWin().webContents.send('menu.test-runner') } },
        { id: 'save-for-test-runner', label: $t('dev.save-test-scenario') || 'Save Test Scenario', click() { targetWin().webContents.send('menu.save-for-test-runner') } },
		{ id: 'save-for-test-runner-end-game', label: $t('dev.save-test-scenario-end-game') || 'Save Test Scenario End Game', click() { targetWin().webContents.send('menu.save-for-test-runner-end-game') } },
        { type: 'separator' },
        { label: $t('dev.reload-add-ons') || 'Reload Add-ons', click() { targetWin().webContents.send('menu.reload-addons') } },
        { id: 'theme-inspector', label: $t('dev.theme-inspector') || 'Theme Inspector', click() { targetWin().webContents.send('menu.theme-inspector') } }
      ]
    })
  }

  menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

export default function () {
  ipcMain.handle('update-menu', (ev, update) => {
    const wcId = ev.sender.id
    perWinEnabled.set(wcId, { ...(perWinEnabled.get(wcId) || {}), ...update })
    // Only apply to the global menu when this window is focused (or is the only window).
    const focused = BrowserWindow.getFocusedWindow()
    if (!focused || focused.webContents.id === wcId) {
      applyWindowState(wcId)
    }
  })

  ipcMain.handle('set-menu-checked', (ev, update) => {
    const wcId = ev.sender.id
    perWinChecked.set(wcId, { ...(perWinChecked.get(wcId) || {}), ...update })
    const focused = BrowserWindow.getFocusedWindow()
    if (!focused || focused.webContents.id === wcId) {
      applyWindowState(wcId)
    }
  })

  ipcMain.handle('translate-menu', async (ev, messages) => {
    if (_win) {
      await createMenu(_win, messages)
      // Re-apply the focused window's state after rebuilding the menu.
      const focused = BrowserWindow.getFocusedWindow() || _win
      applyWindowState(focused.webContents.id)
    }
  })

  return {
    winCreated(win) {
      winWcId.set(win, win.webContents.id)

      // DevTools listeners on every window — checkbox reflects whichever window is focused.
      win.webContents.on('devtools-opened', () => updateDevToolsCheck(win))
      win.webContents.on('devtools-closed', () => updateDevToolsCheck(win))

      // Build the menu only once (for the first / main window). Game windows reuse the same
      // global menu — their state is applied via browser-window-focus when they gain focus.
      if (!_win) {
        _win = win
        createMenu(win, {}).then(() => {
          const focused = BrowserWindow.getFocusedWindow()
          if (focused) {
            applyWindowState(focused.webContents.id)
            applyDevToolsCheck(focused)
          }
        })
      }
    },
    winClosed(win) {
      const wcId = winWcId.get(win)
      winWcId.delete(win)
      if (wcId !== undefined) {
        perWinEnabled.delete(wcId)
        perWinChecked.delete(wcId)
      }
      if (_win === win) {
        _win = null
      }
    }
  }
}