// Reloading the web build to a new version should put the player back in the game they had open.
//
// The update bar at the bottom of the page is plain JS injected by web-build/build.js, outside
// the Vue app, so it cannot read the store or close the socket itself. The app installs a hook
// the bar calls just before it reloads; the hook records the open game and disconnects cleanly,
// so the server drops the seat instead of leaving a ghost behind for the rejoin to fight.
//
// The game is written ONLY at that moment — not as the store changes — so the value can never go
// stale and a local or loaded game (which has an id but nothing to rejoin) is never recorded.
// sessionStorage survives the reload and dies with the tab, so a new tab opens the lobby.
const KEY = 'fcz.rejoin'
// Installed on globalThis, which IS window in the browser — the injected bar reads
// window.__fczBeforeReload. Using globalThis keeps this testable outside a DOM.
export const HOOK = '__fczBeforeReload'

// Storage throws in some privacy modes. Losing the game is a nuisance; failing to reload, or
// crashing on boot, is not — so every access is guarded.
const write = value => {
  try {
    if (value) {
      sessionStorage.setItem(KEY, JSON.stringify(value))
    } else {
      sessionStorage.removeItem(KEY)
    }
  } catch (e) { /* no storage — the game simply is not restored */ }
}

/**
 * Called by the update bar immediately before it reloads. Records the open online game (if any)
 * and closes the connection without navigating — we are about to reload, so any redirect would
 * just fight the reload.
 */
export const installReloadHook = store => {
  globalThis[HOOK] = () => {
    const { networking, game } = store.state
    if (networking.connectionType === 'online' && game.id) {
      write({ gameId: game.id, entry: networking.onlineEntry })
    } else {
      write(null)
    }
    // userIntent stays false: the player is not going offline, so the lobby must still
    // auto-connect after the reload.
    store.dispatch('networking/close', { redirect: false })
  }
}

/** The game to rejoin, consumed so a failed attempt is never retried. */
export const takePendingRejoin = () => {
  let raw = null
  try {
    raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch (e) {
    return null
  }
  if (!raw) {
    return null
  }
  try {
    const value = JSON.parse(raw)
    return value && value.gameId ? value : null
  } catch (e) {
    return null
  }
}
