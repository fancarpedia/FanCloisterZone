import { ipcMain } from 'electron'

const ADDON_DEFAULTS = {
  addonsManifestUrl: 'https://github.com/fancarpedia/FanCloisterZone/releases/download/v6.0.0-all/addons.json'
}

export default function () {
  ipcMain.handle('get-addon-defaults', () => ADDON_DEFAULTS)
}
