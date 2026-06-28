import { dialog, ipcMain, BrowserWindow } from 'electron'

let messages = {}

/**
 * Get translated text for a dialog key
 * @param {string} key - Translation key (e.g., 'resign-and-close')
 * @param {string} fallback - Fallback text if translation not found
 * @returns {string} Translated text or fallback
 */
function getTranslation (dialogKey, key, fallback) {
  if (messages[dialogKey] !== undefined) {
    return messages[dialogKey][key] || fallback
  } else {
    return fallback
  }
}

/**
 * Show the "unfinished game" confirmation dialog with translated texts
 * Can be called from main process directly
 */
// `win` is the window the dialog belongs to (the one being closed / leaving the game). Parenting the
// dialog to the actual window — instead of a shared module-level reference — is required for multiple
// game windows: otherwise once one window closes, the shared reference is gone and every later close
// short-circuits to "continue playing" and can never close.
export async function showUnfinishedGameDialog (win) {
  const resignLabel = getTranslation('close-local-game','resign-and-close', 'Resign and Close')
  const continueLabel = getTranslation('close-local-game','continue-playing', 'Continue playing')
  const title = getTranslation('close-local-game','unfinished-local-game', 'Unfinished Local Game')
  const message = getTranslation('close-local-game','unfinished-local-game-description',
    'You have an unfinished local game. If you close the app window, you will resign and lose your progress in this game.')

  const opts = {
    type: 'warning',
    buttons: [resignLabel, continueLabel],
    defaultId: 0,
    cancelId: 1,
    title,
    message
  }

  try {
    const target = win && !win.isDestroyed() ? win : null
    const result = target
      ? await dialog.showMessageBox(target, opts)
      : await dialog.showMessageBox(opts)
    return result.response
  } catch (err) {
    console.error('Dialog error:', err)
    return 0 // Default to quit app
  }
}

export default function () {
  ipcMain.handle('dialog.showOpenDialog', async (ev, opts) => {
    return await dialog.showOpenDialog(opts)
  })

  ipcMain.handle('dialog.showSaveDialog', async (ev, opts) => {
    return await dialog.showSaveDialog(opts)
  })

  // ipcMain.handle('dialog.showErrorBox', async (ev, { title, content }) => {
  //   dialog.showErrorBox(title, content)
  // })

  /**
   * Update dialog translations from renderer process
   * Call this whenever language changes in your Nuxt app
   */
  ipcMain.handle('translate-dialogs', (ev, updatedMessages) => {
    if (updatedMessages) {
      messages = updatedMessages
    }
  })

  /**
   * Show the "unfinished game" confirmation dialog with translated texts
   * Can be called via IPC from renderer process
   */
  ipcMain.handle('dialog.showUnfinishedGameDialog', async (ev) => {
    return await showUnfinishedGameDialog(BrowserWindow.fromWebContents(ev.sender))
  })

  return {
    winCreated () {},
    winClosed () {}
  }
}

ipcMain.handle('confirm-leave-game', async (ev) => {
  const choice = await showUnfinishedGameDialog(BrowserWindow.fromWebContents(ev.sender))
  // choice === 0 → user confirmed leaving
  return choice === 0
})

