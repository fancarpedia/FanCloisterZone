import fs from 'fs'
import { execFile } from 'child_process'
import crypto from 'crypto'

export const state = () => ({
  // bumped on every expansion (re)load — $tiles is not reactive, so views listing expansions
  // (the Tile Set Boxes) depend on this to show an add-on installed while the app runs
  tilesVersion: 0,
  loaded: {
    settings: false,
    addons: false,
    tiles: false,
    artworks: false
  },
  hasClassicAddon: false,
  gameDialog: null,
  gameChatEdit: null,
  showJoinDialog: false,
  showSettings: false,
  showGameFarmHints: false,
  showGameFeatureHints: false,
  showPotentialScore: false,
  showGameHistory: true,
  // Player supply (followers, tokens, prisoners) in the aside. Starts collapsed: it only has an
  // effect on small screens, where the full panels leave no room for the board, and there the
  // score and flowers alone are what a player needs at a glance.
  showPlayerSupply: false,
  showGameTiles: false,
  showGameSetup: false,
  engine: null,
  appSessionId: crypto.randomBytes(16).toString('hex'),
  download: null,
  updateInfo: null,
  updateProgress: null,
  errorMessage: null,
  runningTests: false
})

// Tournament mode: the game option puristTiles (its old name — it first only hid the remaining tiles).
// No remaining-tiles list, no farm / feature hints (majorities), no potential final score.
export const tournamentMode = state => !!state.game?.setup?.options?.puristTiles

export const mutations = {
  tilesLoaded (state) {
    state.loaded.tiles = true
    state.tilesVersion++
  },

  addonsLoaded (state) {
    state.loaded.addons = true
  },

  artworksLoaded (state) {
    state.loaded.artworks = true
  },

  settingsLoaded (state) {
    state.loaded.settings = true
  },

  hasClassicAddon (state, value) {
    state.hasClassicAddon = value
  },

  gameDialog (state, gameDialog) {
    state.gameDialog = gameDialog
  },

  gameChatEdit (state, gameChatEdit) {
    state.gameChatEdit = gameChatEdit
  },

  showJoinDialog (state, value) {
    state.showJoinDialog = value
  },

  showSettings (state, value) {
    state.showSettings = value
  },

  // Tournament mode (game option puristTiles): no farm / feature hints, no potential final score
  toggleGameFarmHints (state) {
    state.showGameFarmHints = !tournamentMode(state) && !state.showGameFarmHints
  },

  toggleGameFeatureHints (state) {
    state.showGameFeatureHints = !tournamentMode(state) && !state.showGameFeatureHints
  },

  togglePotentialScore (state) {
    state.showPotentialScore = !tournamentMode(state) && !state.showPotentialScore
  },

  // a tournament game opened: switch the aids off (they may still be on from an earlier game)
  tournamentAidsOff (state) {
    state.showGameFarmHints = false
    state.showGameFeatureHints = false
    state.showPotentialScore = false
  },

  toggleGameHistory (state) {
    state.showGameHistory = !state.showGameHistory
  },

  togglePlayerSupply (state) {
    state.showPlayerSupply = !state.showPlayerSupply
  },

  showGameTiles (state, value) {
    state.showGameTiles = value
  },

  showGameSetup (state, value) {
    state.showGameSetup = value
  },

  engine (state, value) {
    state.engine = value
  },

  download (state, value) {
    state.download = value
  },

  downloadProgress (state, value) {
    if (state.download) {
      state.download.progress = value
    }
  },

  downloadSize (state, value) {
    if (state.download) {
      state.download.size = value
    }
  },

  updateInfo (state, value) {
    state.updateInfo = value
  },

  updateProgress (state, value) {
    state.updateProgress = value
  },

  errorMessage (state, value) {
    state.errorMessage = value
  },

  runningTests (state, value) {
    state.runningTests = value
  }
}

export const getters = {
  loaded: state => state.loaded.addons && state.loaded.tiles
}

export const actions = {

  async checkEngineVersion ({ state, commit, rootState }) {
    if (state.engine !== null) {
      // return state.engine
    }
    return new Promise(async (resolve, reject) => {
      const { $engine } = this._vm
      const remote = $engine.isRemote()

      if (remote) {
        const value = {
          ok: true,
          path: `Remote engine on ${remote.host}:${remote.port}`,
          version: ''
        }
        commit('engine', value)
        resolve(value.version)
        return
      }

      const executable = $engine.getEngineExecutable()
      const args = $engine.getEngineArgs()
      const enginePath = args[args.length - 1]

      try {
        await fs.promises.access(enginePath, fs.constants.R_OK)
      } catch (e) {
        console.error(e)
        const value = {
          ok: false,
          path: enginePath,
          error: 'not-found'
        }
        commit('engine', value)
        reject(value)
        return
      }

      execFile(executable, [...args, '--version'], {
        // In a packaged app `executable` is process.execPath (the app's own .exe). Without
        // ELECTRON_RUN_AS_NODE it would relaunch the FULL APP instead of running Node on the
        // engine bundle — and since each launch runs this probe again, that fork-bombs.
        env: { ...window.process.env, ELECTRON_RUN_AS_NODE: '1' }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(error)
          const value = {
            ok: false,
            path: enginePath,
            error: 'exec-error',
            errorMessage: '' + error
          }
          commit('engine', value)
          reject(value)
        } else {
          const version = stdout.trim()
          console.log('engine version ' + version)
          const value = {
            ok: true,
            path: enginePath,
            version
          }
          commit('engine', value)
          resolve(version)
        }
      })
    })
  }
}
