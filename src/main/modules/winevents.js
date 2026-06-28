import path from 'path'
import { ipcMain, app, BrowserWindow } from 'electron'

export default function () {
  // These IPCs act on the window that sent them, so they work with any number of windows.
  ipcMain.handle('win.isVisible', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isMinimized() && !win.isVisible()
  })

  ipcMain.handle('win.setProgressBar', async (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setProgressBar(...args)
    }
  })

  ipcMain.handle('win.setIcon', async (event, icon) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (process.env.NODE_ENV === 'development') {
        win.setIcon(path.join('icons', icon))
      } else {
        const basePath = path.dirname(app.getAppPath())
        win.setIcon(path.join(basePath, 'icons', icon))
      }
    }
  })

  return {
    // Bind listeners to THIS window so each window notifies its own renderer (no shared module state).
    winCreated (win) {
      win.on('restore', () => win.webContents.send('win.restore'))
      win.on('show', () => win.webContents.send('win.show'))
      win.on('focus', () => win.webContents.send('win.focus'))
      win.on('minimize', () => win.webContents.send('win.minimize'))
      win.on('hide', () => win.webContents.send('win.hide'))
      win.on('blur', () => win.webContents.send('win.blur'))
    },
    winClosed () {}
  }
}
