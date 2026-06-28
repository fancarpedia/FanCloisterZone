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

// Routes that mean "a game is on screen" — entering one arms the close-on-home behaviour.
const GAME_ROUTES = ['/game', '/open-game', '/game-setup']

export default ({ app }, inject) => {
  const role = readRole()
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
      ipcRenderer.invoke('open-game-window', intent)
      return true
    },

    // Report the gameId this window ended up running (online de-dupe / focus on re-join).
    setGameId (gameId) {
      ipcRenderer.send('game-window.set-gameid', gameId || null)
    },

    // In-game close: tear the window down (renderer should have closed its game first).
    closeSelf () {
      ipcRenderer.send('close-self-window')
    }
  }

  inject('windows', Vue.prototype.$windows)
}
