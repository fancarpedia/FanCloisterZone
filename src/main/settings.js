import fs from 'fs'
import path from 'path'
import { app, ipcMain, BrowserWindow } from 'electron'

export const SETTINGS_FILE = process.env.JCZ_CONFIG || path.join(app.getPath('userData'), 'jcz-config.json')

let settings = null
let saving = false

export function isSaveInProgress () {
  return saving
}

export async function getSettings () {
  return settings || {}
}

// Synchronous access to the in-memory settings (already loaded before any window is created).
export function getSettingsSync () {
  return settings || {}
}

export async function loadSettings () {
  try {
    await fs.promises.access(SETTINGS_FILE, fs.constants.R_OK)
    settings = JSON.parse(await fs.promises.readFile(SETTINGS_FILE))
    return settings
  } catch {
    return null
  }
}

// Authoritative single-writer patch for SHARED settings (e.g. the dev "Use Local Play Online"
// toggle). Merges `update` into the on-disk settings once, from the main process — so windows
// don't each re-save their full (possibly stale) blob and clobber each other's value.
export async function applySettingsPatch (update) {
  saving = true
  try {
    const merged = { ...(settings || {}), ...update }
    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2))
    settings = merged
    return merged
  } finally {
    saving = false
  }
}

export default async function () {
  ipcMain.handle('settings.get', () => {
    return { settings, file: SETTINGS_FILE, systemLocale: app.getSystemLocale() || 'en-US' }
  })

  ipcMain.handle('settings.save', async (ev, data) => {
    saving = true
    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2))
    settings = data
    saving = false
    // Tell every OTHER window about it. The fs watcher cannot be relied on here: it is skipped
    // while isSaveInProgress(), and modules/settingsWatch keeps a single module-level watcher, so
    // only the most recently created window would ever be notified. Without this, a language (or
    // any other setting) picked in one window never reaches the windows already open — including
    // the hidden warm window that the next "New Game" click will claim.
    const payload = { settings: data, file: SETTINGS_FILE, systemLocale: app.getSystemLocale() || 'en-US' }
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      const wc = win.webContents
      if (wc.id === ev.sender.id) continue // the sender already has it
      wc.send('settings.changed', payload)
    }
  })

  console.log(`Loading settings from ${SETTINGS_FILE}`)
  return await loadSettings()
}
