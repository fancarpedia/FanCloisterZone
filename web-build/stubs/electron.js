// Browser stub for `electron`.
//
// Of the 88 IPC channels the renderer uses, ~55 are desktop-only chrome (menu.* / win.* / taskbar /
// updater) that simply never fire in a browser, and ~16 are multi-window coordination that collapses
// to a single window. Only a handful are load-bearing — those are answered in REPLIES below.
//
// Every call is recorded on `window.__IPC__` so you can inspect what the app actually touches:
//   window.__IPC__.calls.map(c => c.kind + ':' + c.channel)
const calls = []
const handlers = {}

if (typeof window !== 'undefined') {
  window.__IPC__ = { calls, handlers }
}

const record = (kind, channel) => { calls.push({ kind, channel, at: Date.now() }) }

const REPLIES = {
  // Must be the REAL version: addons declare a `minimumJczVersion` and are rejected if the app
  // looks older. build.js puts it on window.__APP_VERSION__ from package.json.
  'get-app-version': () => (typeof window !== 'undefined' && window.__APP_VERSION__) || '0.0.0',
  'get-my-window-id': () => 1,
  'list-game-windows': () => [],

  // Settings are backed by localStorage instead of a file on disk.
  // Contract (src/main/settings.js): { settings, file, systemLocale } — `settings` may be null,
  // in which case the store creates defaults.
  'settings.get': () => {
    const raw = window.localStorage.getItem('fcz.settings')
    const settings = raw ? JSON.parse(raw) : null

    // One-time migration. An earlier build's os stub returned a hardcoded userInfo().username of
    // 'Player', so settings.js seeded that as the nickname and the app never showed its
    // "choose a nickname" dialog — every web player ended up on the server as "Player".
    // That name can only have come from the stub (the dialog never ran to let anyone type it), so
    // clearing it is safe; an empty nickname makes the app prompt, as the desktop build does.
    // Guarded by a marker so a user who genuinely picks "Player" later keeps it.
    const MIGRATION = 'fcz.nickname-placeholder-cleared'
    if (settings && settings.nickname === 'Player' && !window.localStorage.getItem(MIGRATION)) {
      settings.nickname = null
      window.localStorage.setItem(MIGRATION, '1')
      window.localStorage.setItem('fcz.settings', JSON.stringify(settings))
    }

    return {
      settings,
      file: 'localStorage:fcz.settings',
      systemLocale: navigator.language || 'en-US'
    }
  },
  'settings.save': (data) => {
    window.localStorage.setItem('fcz.settings', JSON.stringify(data))
    return true
  },

  // Native confirm dialogs -> window.confirm. These MUST answer truthfully: the caller does
  // `if (!confirmed) return`, so a stubbed null reads as "cancelled" and the action silently does
  // nothing (this is what broke the game-setup / choose-slots close buttons for a local game).
  'confirm-leave-game': () =>
    window.confirm('The game is not finished. Leave anyway?'),

  'confirm-online-games-dialog': (texts = {}) =>
    // main returns { response } where 0 = confirm
    ({ response: window.confirm(texts.message || 'Switching the online server will close all open online games. Continue?') ? 0 : 1 })
}

export const ipcRenderer = {
  invoke (channel, ...args) {
    record('invoke', channel)
    const fn = REPLIES[channel]
    return Promise.resolve(fn ? fn(...args) : null)
  },
  send (channel) { record('send', channel) },
  sendSync (channel, ...args) {
    record('sendSync', channel)
    const fn = REPLIES[channel]
    return fn ? fn(...args) : null
  },
  on (channel, cb) {
    record('on', channel)
    ;(handlers[channel] || (handlers[channel] = [])).push(cb)
    return this
  },
  once (channel, cb) { return this.on(channel, cb) },

  // Electron's ipcRenderer IS an EventEmitter, and the app relies on that: it dispatches menu
  // actions to ITSELF with `ipcRenderer.emit('menu.leave-game')` (see game-setup.vue /
  // open-game.vue close buttons). Without emit() those buttons throw and do nothing.
  emit (channel, ...args) {
    record('emit', channel)
    ;(handlers[channel] || []).forEach((cb) => cb({ channel }, ...args))
    return true
  },

  addListener (channel, cb) { return this.on(channel, cb) },

  removeListener (channel, cb) {
    if (handlers[channel]) handlers[channel] = handlers[channel].filter((h) => h !== cb)
    return this
  },

  // EventEmitter's documented alias for removeListener. ActionPanel.vue unsubscribes its six
  // win.* handlers with off() in beforeDestroy — without it, TEARING DOWN the game board throws
  // "ipcRenderer.off is not a function" and the rest of beforeDestroy (clearProgress) never runs.
  off (channel, cb) { return this.removeListener(channel, cb) },
  removeAllListeners (channel) {
    if (channel) delete handlers[channel]
    return this
  }
}

// --- keyboard accelerators ---------------------------------------------------------------------
// On desktop these live on Electron's native menu (accelerator: 'CommandOrControl+Z' ->
// webContents.send('menu.undo')). A browser has no native menu, so the shortcuts would simply not
// work. Re-create them here by dispatching the same IPC channels the menu would.
//
// Deliberately NOT bound: CommandOrControl+W (leave-game) and +N (new-game) — browsers reserve
// those for closing/opening tabs and will not yield them.
const ACCELERATORS = [
  { key: 'z', ctrl: true, channel: 'menu.undo' },
  { key: 's', ctrl: true, channel: 'menu.save-game' },
  { key: 'o', ctrl: true, channel: 'menu.load-game' },
  { key: ',', ctrl: true, channel: 'menu.show-settings' },
  { key: 'j', ctrl: true, channel: 'menu.join-game' }
]

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (ev) => {
    // don't steal keys while the user is typing (chat, rename, settings...)
    const t = ev.target
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    const ctrl = ev.ctrlKey || ev.metaKey
    if (!ctrl) return
    const hit = ACCELERATORS.find((a) => a.ctrl === ctrl && a.key === ev.key.toLowerCase())
    if (!hit) return
    if (!handlers[hit.channel] || !handlers[hit.channel].length) return // nothing listening
    ev.preventDefault()
    ipcRenderer.emit(hit.channel)
  })
}

export const shell = { openExternal: (url) => window.open(url, '_blank') }
export const clipboard = { writeText: (t) => navigator.clipboard && navigator.clipboard.writeText(t) }

// Zoom: browsers have no webFrame. No-ops — the browser's own zoom still works.
export const webFrame = {
  setZoomFactor: () => {},
  getZoomFactor: () => 1,
  setZoomLevel: () => {},
  getZoomLevel: () => 0,
  setVisualZoomLevelLimits: () => {},
  setLayoutZoomLevelLimits: () => {}
}

export const remote = {}
export const app = {}
export default { ipcRenderer, shell, clipboard, webFrame, remote, app }
