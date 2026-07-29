import Vue from 'vue'
import { ipcRenderer } from 'electron'

// Multi-window support: each game runs in its own OS window. A window is either the lobby ('main')
// or a dedicated single-game window ('game'). The role is passed by the main process via
// additionalArguments (see src/main/index.js buildWindow).
function readRole () {
  try {
    const arg = (window.process.argv || []).find(a => a.startsWith('--window-role='))
    return arg ? arg.replace('--window-role=', '') : 'main'
  } catch (e) {
    return 'main'
  }
}

// Can this platform open a game in its own OS window? Electron can; a browser / mobile WebView
// cannot (one document, one window), so there every game is handled in-place by the caller.
// The web build passes --single-window (see web-build/build.js).
function readSingleWindow () {
  try {
    return (window.process.argv || []).includes('--single-window')
  } catch (e) {
    return false
  }
}

// Routes that mean "a game is on screen" — entering one arms the close-on-home behaviour.
const GAME_ROUTES = ['/game', '/open-game', '/game-setup']

export default ({ app }, inject) => {
  const role = readRole()
  const singleWindow = readSingleWindow()
  // Our own webContents id, used to exclude this window from the open-windows list. Resolved async
  // on boot; null until the main process answers (the lobby/'main' window is never in the list anyway).
  let myWindowId = null
  ipcRenderer.invoke('get-my-window-id').then(id => { myWindowId = id }).catch(() => {})
  // Once a game window has shown a game, navigating back to the lobby home means the game is over
  // → close the window instead of rerouting (the lobby lives in the main window).
  let armed = false

  if (role === 'game' && app.router) {
    app.router.beforeEach((to, from, next) => {
      if (GAME_ROUTES.includes(to.path)) {
        armed = true
        return next()
      }
      if (to.path === '/') {
        if (armed) {
          // game is over → close the window instead of returning to the lobby home
          ipcRenderer.send('close-self-window')
          return next(false)
        }
        // initial boot (before the launch intent arrives): hold on the neutral loading page
        return next('/loading')
      }
      next()
    })
  }

  // The lobby ('main') window boots into the online lobby (/online) instead of the legacy
  // landing page. Only the very first navigation is redirected, so index.vue ('/') stays
  // reachable afterwards (and still renders the shared EngineAlerts / AppUpdateBox).
  if (role === 'main' && app.router) {
    let bootRedirectDone = false
    app.router.beforeEach((to, from, next) => {
      if (!bootRedirectDone && to.path === '/') {
        bootRedirectDone = true
        return next('/online')
      }
      next()
    })
  }

  Vue.prototype.$windows = {
    role,

    isGameWindow () {
      return role === 'game'
    },

    // Open a game in its own window. Returns true if a window was requested, false if the caller
    // should handle the game in-place instead. We only run in-place when the Test Runner is driving
    // games in the background (runningTests) — otherwise every launch gets its own window, even when
    // triggered from another game window (one game per window, never clobber the current one).
    openGame (intent, { force = false } = {}) {
      if (!force && app.store.state.runningTests) return false
      // No OS windows on this platform (browser / mobile) — tell the caller to run it in-place.
      // Every call site already falls back to `dispatch(newGame) + router.push(...)`.
      if (singleWindow) return false
      ipcRenderer.invoke('open-game-window', intent)
      return true
    },

    // Report the gameId this window ended up running (online de-dupe / focus on re-join).
    setGameId (gameId) {
      ipcRenderer.send('game-window.set-gameid', gameId || null)
    },

    // Report this window's online game key (e.g. "ABC-123") so the lobby's open-windows list can
    // show it for online games.
    setKey (key) {
      ipcRenderer.send('game-window.set-key', key || null)
    },

    // Report the active player ({ slot, isMe }) so the lobby's open-windows bullet can show that
    // player's colour (and blink when it's my turn).
    setActive (active) {
      ipcRenderer.send('game-window.set-active', active || null)
    },

    // Report this window's game setup ({ sets, elements }) so the lobby's open-windows list can
    // render the setup overview.
    setSetup (setup) {
      ipcRenderer.send('game-window.set-setup', setup || null)
    },

    // Report this window's tile progress ({ used, total }) — the same placed/total count the server
    // stores from the COMMIT message — so the lobby's open-windows list can show it.
    setProgress (progress) {
      ipcRenderer.send('game-window.set-progress', progress || null)
    },

    // In-game close: tear the window down (renderer should have closed its game first).
    closeSelf () {
      ipcRenderer.send('close-self-window')
    },

    // This window's own webContents id (or null before it has been resolved).
    myWindowId () {
      return myWindowId
    },

    // --- open game-windows list (shown in the lobby) ----------------------------------------------
    // Fetch the current list of open game windows.
    listGameWindows () {
      return ipcRenderer.invoke('list-game-windows')
    },

    // Bring a game window to the front.
    focusGameWindow (id) {
      ipcRenderer.send('focus-game-window', id)
    },

    // Close a game window.
    closeGameWindow (id) {
      ipcRenderer.send('close-game-window', id)
    },

    // Subscribe to live changes of the open-windows list. Returns an unsubscribe function.
    onWindowsChanged (cb) {
      const handler = (event, list) => cb(list)
      ipcRenderer.on('game-windows.changed', handler)
      return () => ipcRenderer.removeListener('game-windows.changed', handler)
    }
  }

  inject('windows', Vue.prototype.$windows)
}
