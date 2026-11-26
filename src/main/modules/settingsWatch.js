import fs from 'fs'
import { app, BrowserWindow } from 'electron'

import { loadSettings, isSaveInProgress, SETTINGS_FILE } from '../settings'

let timeout = null
let watcher = null

export default function () {
  return {
    winCreated () {
      if (watcher || timeout) return
      timeout = setTimeout(() => {
        timeout = null
        try {
          watcher = fs.watch(SETTINGS_FILE, eventType => {
            if (eventType === 'change' && !isSaveInProgress()) {
              loadSettings().then(settings => {
                const payload = { settings, file: SETTINGS_FILE, systemLocale: app.getSystemLocale() || 'en-US' }
                for (const win of BrowserWindow.getAllWindows()) {
                  if (!win.isDestroyed()) {
                    win.webContents.send('settings.changed', payload)
                  }
                }
              })
            }
          })
          console.log(`Watching ${SETTINGS_FILE}`)
        } catch (e) {
          console.error(e)
        }
      }, 500)
    },

    winClosed () {
      const remaining = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed())
      if (remaining.length > 0) return

      clearTimeout(timeout)
      timeout = null

      if (watcher) {
        watcher.close()
        watcher = null
      }
    }
  }
}
