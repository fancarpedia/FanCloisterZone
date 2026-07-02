import Vue from 'vue'
import { ipcRenderer } from 'electron'

import { getAppVersion } from '@/utils/version'
import { randomId } from '@/utils/random'

export default ({ app }, inject) => {
  let running = false

  Vue.prototype.$server = {
    port: null,

    async start (game) {
      const { settings } = app.store.state
      const appVersion = getAppVersion()
      const engineVersion = app.store.state.engine ? app.store.state.engine.version : ''
      if (!game.gameId) {
        game = { gameId: randomId(), ...game }
      }

      // Main assigns a free port per window and returns it so this window connects to its own server.
      const { port } = await ipcRenderer.invoke('localserver.start', {
        game,
        clientId: settings.clientId,
        appVersion,
        engineVersion
      })
      this.port = port
      running = true
      return { port }
    },

    async stop () {
      running = false
      await ipcRenderer.invoke('localserver.stop')
    },

    isRunning () {
      return running
    },

    async dump () {
      return await ipcRenderer.invoke('localserver.dump')
    }
  }
}
