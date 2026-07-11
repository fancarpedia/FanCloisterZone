<template>
  <v-app>
    <div v-if="notifyConnectionReconnecting" class="top-bar">
      <v-alert type="error">
        Connection interrupted. Reconnecting&hellip;
        <v-progress-linear
          indeterminate
          color="white"
        />
      </v-alert>
    </div>

    <nuxt />
    <v-dialog
      v-model="showAbout"
      max-width="600"
    >
      <AboutDialog
        @close="showAbout = false"
      />
    </v-dialog>
    <v-dialog
      v-model="showJoinDialog"
      max-width="600"
    >
      <!-- use if to always create fresh dialog instance -->
      <JoinGameDialog
        v-if="showJoinDialog"
        @close="showJoinDialog = false"
      />
    </v-dialog>
    <v-dialog
      v-model="showSettings"
      content-class="settings-dialog"
      max-width="800"
    >
      <SettingsDialog
        ref="settings"
        @close="showSettings = false"
      />
    </v-dialog>
    <v-dialog
      v-model="showErrorDialog"
      content-class="error-dialog"
      max-width="800"
    >
      <ErrorDialog
        v-if="errorMessage"
        :msg="errorMessage"
        @close="showErrorDialog = false"
      />
    </v-dialog>

    <v-dialog
      v-model="savedScenarioDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('dev.test-scenario-saved') }}</span>
        </v-card-title>
        <v-card-text>
          <p>{{ $t('dev.test-scenario-saved-hint') }}</p>
          <code class="scenario-path">{{ savedScenarioPath }}</code>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="savedScenarioDialog = false">{{ $t('button.close') }}</v-btn>
          <v-btn text color="primary" @click="openSavedScenario">{{ $t('button.open') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script>
import os from 'os'
import fs from 'fs'
import { extname } from 'path'
import { webFrame, shell, ipcRenderer, ipcMain, dialog } from 'electron'
import { mapState, mapGetters } from 'vuex'

import AboutDialog from '@/components/AboutDialog'
import ErrorDialog from '@/components/ErrorDialog'
import JoinGameDialog from '@/components/JoinGameDialog'
import SettingsDialog from '@/components/SettingsDialog'
import { getAppVersion } from '@/utils/version'

import { STATUS_CONNECTED } from '@/store/networking'

const ZOOM_SENSITIVITY = 1.4

export default {
  components: {
    AboutDialog,
    ErrorDialog,
    JoinGameDialog,
    SettingsDialog
  },

  data () {
    return {
      showAbout: false,
      addonsUpdated: false,
      savedScenarioDialog: false,
      savedScenarioPath: null
    }
  },

  computed: {
    ...mapState({
      engine: state => state.engine,
      connectionState: state => state.networking.connectionStatus,
      onlineConnected: state => state.networking.connectionType === 'online',
      errorMessage: state => state.errorMessage,
      showGameFarmHints: state => state.showGameFarmHints,
      showGameFeatureHints: state => state.showGameFeatureHints,
      showPotentialScore: state => state.showPotentialScore,
      showGameHistory: state => state.showGameHistory
    }),

    ...mapGetters({
      undoAllowed: 'game/isUndoAllowed'
    }),

    showJoinDialog: {
      get () {
        return this.$store.state.showJoinDialog
      },

      set (value) {
        this.$store.commit('showJoinDialog', value)
      }
    },

    showSettings: {
      get () {
        return this.$store.state.showSettings
      },

      set (value) {
        this.$store.commit('showSettings', value)
      }
    },

    showErrorDialog: {
      get () {
        return !!this.errorMessage
      },

      set (value) {
        this.$store.commit('errorMessage', null)
      }
    },

    notifyConnectionReconnecting () {
      return this.connectionState === 'reconnecting'
    },

    // Effective game setup for this window (the running game, else the setup being edited). Reported
    // to the main process so the lobby's open-windows list can render a setup overview.
    gameWindowSetup () {
      const g = this.$store.state.game
      if (g && g.setup && g.setup.sets && g.setup.elements) {
        return { sets: g.setup.sets, elements: g.setup.elements }
      }
      const gs = this.$store.state.gameSetup
      if (gs && gs.sets && gs.elements) {
        return { sets: gs.sets, elements: gs.elements }
      }
      return null
    },

    // Tile progress ({ used, total }) of this window's running game — the same placed/total count
    // the server stores from the COMMIT message. Reported for the lobby's open-windows list.
    gameWindowProgress () {
      const g = this.$store.state.game
      if (g && g.tilePack && typeof g.packSize === 'number') {
        return { used: g.packSize - g.tilePack.size, total: g.packSize }
      }
      return null
    },

    // Active player ({ slot, isMe }) of this window's running game, so the lobby's open-windows
    // bullet can show that player's colour and blink when it is my turn.
    gameWindowActive () {
      const g = this.$store.state.game
      if (!g || !g.action || !g.players) {
        return null
      }
      const p = g.players[g.action.player]
      if (!p) {
        return null
      }
      return { slot: p.slot, isMe: this.$store.getters['game/isActionLocal'] }
    }
  },

  watch: {
    $route (to) {
      this.updateMenu()
      this.updateTitle()
    },

    undoAllowed () {
      this.updateMenu()
    },

    onlineConnected () {
      this.updateMenu()
      this.updateTitle()
    },

    showSettings (val) {
      if (val && typeof this.$refs.settings?.clean === 'function') {
        this.$refs.settings.clean()
      }
    },

    engine () {
      this.updateMenu()
    },

    showGameFarmHints () {
      this.syncMenuChecks()
    },

    showGameFeatureHints () {
      this.syncMenuChecks()
    },

    showPotentialScore () {
      this.syncMenuChecks()
    },

    showGameHistory () {
      this.syncMenuChecks()
    },

    // In a game window, report the running gameId so a later online join focuses this window.
    '$store.state.game.id' (id) {
      if (this.$windows.isGameWindow() && id) {
        this.$windows.setGameId(id)
      }
      this.updateTitle()
    },

    // In a game window, report the online game key so the lobby's open-windows list can show it.
    '$store.state.game.key': {
      handler (key) {
        if (this.$windows.isGameWindow()) {
          this.$windows.setKey(key)
        }
      },
      immediate: true
    },

    // In a game window, report the setup so the lobby's open-windows list shows a setup overview.
    gameWindowSetup: {
      handler (setup) {
        if (this.$windows.isGameWindow()) {
          this.$windows.setSetup(setup)
        }
      },
      deep: true,
      immediate: true
    },

    // In a game window, report tile progress so the lobby's open-windows list shows placed/total.
    gameWindowProgress: {
      handler (progress) {
        if (this.$windows.isGameWindow()) {
          this.$windows.setProgress(progress)
        }
      },
      immediate: true
    },

    // In a game window, report the active player so the lobby's open-windows bullet shows its colour.
    gameWindowActive: {
      handler (active) {
        if (this.$windows.isGameWindow()) {
          this.$windows.setActive(active)
        }
      },
      deep: true,
      immediate: true
    }
  },

  created () {
    ipcRenderer.on('app-update', (event, updateInfo) => {
      this.$store.commit('updateInfo', updateInfo)
    })
    ipcRenderer.on('update-progress', (event, progress) => {
      this.$store.commit('updateProgress', progress.percent)
    })

    ipcRenderer.on('menu.playonline-connect', () => {
      this.$store.dispatch('networking/connectPlayOnlineFan')
    })
    ipcRenderer.on('menu.playonline-disconnect', () => {
      // close() is role-aware: the lobby stays on /online, game windows tear down.
      // userIntent: the user chose to disconnect — suppress the lobby's auto-reconnect.
      this.$store.dispatch('networking/close', { userIntent: true })
    })
    ipcRenderer.on('menu.new-game', () => {
      if (this.$windows.openGame({ kind: 'new-local' })) return
      this.$store.dispatch('gameSetup/newGame')
      this.$router.push('/game-setup')
    })
    ipcRenderer.on('menu.join-game', () => {
      this.showJoinDialog = true
    })
    ipcRenderer.on('menu.leave-game', () => {
      this.leaveGame()
    })
    ipcRenderer.on('menu.save-game', () => {
      this.$store.dispatch('game/save')
    })
    ipcRenderer.on('menu.load-game', async () => {
      const file = await this.$store.dispatch('game/chooseSaveFile')
      if (!file) return
      if (this.$windows.openGame({ kind: 'load', payload: { file } })) return
      this.$store.dispatch('game/load', { file })
    })
    ipcRenderer.on('menu.show-settings', () => {
      this.showSettings = true
    })
    ipcRenderer.on('menu.undo', () => {
      this.$store.dispatch('game/undo')
    })
    ipcRenderer.on('menu.zoom-in', () => {
      this.$root.$emit('request-zoom', ZOOM_SENSITIVITY)
    })
    ipcRenderer.on('menu.zoom-out', () => {
      this.$root.$emit('request-zoom', -ZOOM_SENSITIVITY)
    })
    ipcRenderer.on('menu.rotate', () => {
      this.$root.$emit('request-rotate', 90)
    })
    ipcRenderer.on('menu.game-tiles', () => {
      this.$store.commit('showGameTiles', !this.$store.state.showGameTiles)
    })
    ipcRenderer.on('menu.game-farm-hints', () => {
      this.$store.commit('toggleGameFarmHints')
    })
    ipcRenderer.on('menu.game-feature-hints', () => {
      this.$store.commit('toggleGameFeatureHints')
    })
    ipcRenderer.on('menu.game-potential-score', () => {
      this.$store.commit('togglePotentialScore')
    })
    ipcRenderer.on('menu.game-history', () => {
      this.$store.commit('toggleGameHistory')
    })
    ipcRenderer.on('menu.game-setup', () => {
      this.$store.commit('showGameSetup', true)
    })
    ipcRenderer.on('menu.rules', () => {
      shell.openExternal('https://wikicarpedia.com/car/Special:MyLanguage/Main_Page')
    })
    ipcRenderer.on('menu.report-bug', () => {
      shell.openExternal('https://discord.gg/CswNeVg3eS')
    })
    ipcRenderer.on('menu.discord', () => {
      shell.openExternal('https://discord.gg/CswNeVg3eS')
    })
    ipcRenderer.on('menu.about', () => {
      this.showAbout = true
    })

    ipcRenderer.on('menu.dump-server', () => {
      this.dumpServer()
    })
    ipcRenderer.on('menu.save-for-test-runner', () => {
      this.saveScenario(false)
    })
    ipcRenderer.on('menu.save-for-test-runner-end-game', () => {
      this.saveScenario(true)
    })
    ipcRenderer.on('menu.test-runner', () => {
      this.$router.push('/test-runner')
    })
    ipcRenderer.on('menu.reload-addons', () => {
      this.loadAddons()
    })
    ipcRenderer.on('menu.theme-inspector', () => {
      this.$router.push('/theme-inspector')
    })
  },

  async mounted () {
    webFrame.setZoomLevel(0)
    webFrame.setVisualZoomLevelLimits(1, 1)

    const onThemeChange = val => {
      if (val === 'dark') {
        this.$vuetify.theme.dark = true
        ipcRenderer.invoke('theme.change', 'dark')
      } else {
        this.$vuetify.theme.dark = false
        ipcRenderer.invoke('theme.change', 'light')
      }
    }

    await this.$store.dispatch('settings/loaded', await ipcRenderer.invoke('settings.get'))
    onThemeChange(this.$store.state.settings.theme)
    this.$i18n.setLocale(this.$store.state.settings.locale)
    this.updateMenu()
    this.updateTitle()
    this.syncMenuChecks()

    ipcRenderer.on('error', (ev, value) => {
      this.$store.commit('errorMessage', value)
    })

    ipcRenderer.on('settings.changed', (ev, value) => {
      this.$store.dispatch('settings/loaded', value)
    })

    ipcRenderer.on('settings.update', async (ev, update) => {
      const wasOnline = this.$store.state.networking.connectionType === 'online'
      await this.$store.dispatch('settings/update', update)
      this.$store.dispatch('checkEngineVersion')
      // Dev "Use Local Play Online" toggle changed the online target → disconnect and reconnect
      // to the new server so the switch takes effect immediately.
      if (wasOnline && update && Object.prototype.hasOwnProperty.call(update, 'localPlayOnline')) {
        await this.$store.dispatch('networking/reconnectOnline')
      }
    })
    
    this.$store.dispatch('checkEngineVersion')

    await this.loadAddons()

    window.addEventListener('keydown', this.onKeyDown)

    await this.$store.dispatch('settings/registerChangeCallback', ['theme', onThemeChange])
    await this.$store.dispatch('settings/registerChangeCallback', ['userAddons', () => { this.loadAddons() }])
    await this.$store.dispatch('settings/registerChangeCallback', ['enabledArtworks', (_, source) => {
      if (source === 'load') {
        // load only when triggered by manual user change, otherwise it's cause by addon install/uninstall and reloaed from her
        this.$theme.loadArtworks()
      }
    }])
    await this.$store.dispatch('settings/registerChangeCallback', ['dev', () => { this.updateMenu() }])

    this.$addons.on('change', async () => {
      await this.loadAddons()
    })

    // Multi-window: a dedicated game window asks the main process for its launch intent and runs it.
    if (this.$windows.isGameWindow()) {
      ipcRenderer.on('game-window.init', (ev, { intent }) => this.handleGameWindowInit(intent))
      ipcRenderer.send('game-window.ready')
    }

    // Taskbar chat badge: a red-dot overlay when a chat message (game or global) arrives while
    // this window is unfocused; cleared the moment the window regains focus.
    ipcRenderer.on('win.focus', () => {
      ipcRenderer.invoke('win.setChatBadge', false)
    })
    this._unwatchChatBadge = this.$store.watch(
      state => (Array.isArray(state.game.gameChat) ? state.game.gameChat.length : 0) +
        state.globalChat.messages.length,
      (count, prev) => {
        if (count > prev && !document.hasFocus()) {
          ipcRenderer.invoke('win.setChatBadge', true)
        }
      }
    )
  },

  beforeDestroy () {
    window.removeEventListener('keydown', this.onKeyDown)
    this._unwatchChatBadge && this._unwatchChatBadge()
  },

  methods: {
    // Save the current game as a test scenario, then offer to open it for verification.
    async saveScenario (endGame) {
      try {
        const filePath = await this.$store.dispatch('game/savescenario', { endGame })
        if (filePath) {
          this.savedScenarioPath = filePath
          this.savedScenarioDialog = true
        }
      } catch (e) {
        // savescenario already surfaces the failure via errorMessage; nothing to add here.
        console.error(e)
      }
    },

    // Open the just-saved scenario in its own window (force so it opens from a game window too),
    // so the user can replay it and see the assertions run.
    openSavedScenario () {
      const file = this.savedScenarioPath
      this.savedScenarioDialog = false
      if (!file) return
      if (this.$windows.openGame({ kind: 'load', payload: { file } }, { force: true })) return
      this.$store.dispatch('game/load', { file })
    },

    // Run the launch intent delivered to a dedicated game window. On failure/cancel the (empty)
    // window closes itself. Reuses the existing store flows, just without the lobby UI.
    async handleGameWindowInit (intent) {
      if (!intent) { this.$windows.closeSelf(); return }
      const { kind, payload = {} } = intent
      try {
        if (kind === 'new-local') {
          await this.$store.dispatch(payload.ai ? 'gameSetup/newGameAI' : 'gameSetup/newGame')
          this.$router.push('/game-setup' + (payload.tab !== undefined ? `?tab=${payload.tab}` : ''))
        } else if (kind === 'load') {
          const loaded = await this.$store.dispatch('game/load', payload.file ? { file: payload.file } : {})
          if (!loaded) { this.$windows.closeSelf(); return } // dialog cancelled / load failed
        } else if (kind === 'load-setup') {
          await this.$store.dispatch('gameSetup/load', payload.setup)
          this.$router.push('/game-setup')
        } else if (kind === 'join-direct') {
          await this.$store.dispatch('networking/connect', { host: payload.host, connectionType: 'direct' })
          if (this.$store.state.networking.connectionStatus !== STATUS_CONNECTED) { this.$windows.closeSelf(); return }
        } else if (kind === 'join-online') {
          if (!await this.connectForGame(payload)) return
          this.$connection.send({ type: 'JOIN_GAME', payload: payload.gameId ? { gameId: payload.gameId } : { gameKey: payload.gameKey } })
        } else if (kind === 'create-online') {
          if (!await this.connectForGame(payload)) return
          await this.$store.dispatch('gameSetup/newGame')
          this.$router.push('/game-setup')
        } else {
          this.$windows.closeSelf()
        }
      } catch (e) {
        console.error('game window init failed', e)
        this.$windows.closeSelf()
      }
    },

    // Establish this window's own online connection (its own seat) before joining/creating.
    async connectForGame (payload) {
      const action = payload.fan === false ? 'networking/connectPlayOnline' : 'networking/connectPlayOnlineFan'
      await this.$store.dispatch(action)
      if (this.$store.state.networking.connectionStatus !== STATUS_CONNECTED) {
        this.$windows.closeSelf()
        return false
      }
      return true
    },

    async loadAddons () {
      await this.$addons.loadAddons()
      await this.$tiles.loadExpansions()
      if (!this.addonsUpdated) {
        await this.$addons.updateOutdatedAddons()
        this.addonsUpdated=true
      }
      
      await this.$theme.loadArtworks()
    },

    updateMenu () {
      const routeName = this.$route.name
      const gameOpen = routeName === 'game-setup' || routeName === 'open-game' || routeName === 'game'
      const gameRunning = routeName === 'game'

      ipcRenderer.invoke('update-menu', {
        'playonline-connect': !this.onlineConnected && !gameOpen && this.engine?.ok,
        'playonline-disconnect': this.onlineConnected,
        'new-game': !this.onlineConnected && !gameOpen,
        'join-game': !this.onlineConnected && !gameOpen && this.engine?.ok,
        'leave-game': gameOpen,
        'save-game': gameRunning,
        'load-game': !gameOpen && this.engine?.ok,
        'undo': gameRunning && this.undoAllowed,
        'zoom-in': gameRunning,
        'zoom-out': gameRunning,
        'rotate': gameRunning,
        'toggle-history': gameRunning,
        'game-tiles': gameRunning,
        'game-farm-hints': gameRunning,
        'game-feature-hints': gameRunning,
        'game-potential-score': gameRunning,
        'game-setup': gameRunning,
        'dump-server': this.$server.isRunning(),
        'theme-inspector': !gameOpen,
        'save-for-test-runner': gameRunning,
        'save-for-test-runner-end-game': gameRunning
      })
    },

    syncMenuChecks () {
      ipcRenderer.invoke('set-menu-checked', {
        'game-farm-hints': this.showGameFarmHints,
        'game-feature-hints': this.showGameFeatureHints,
        'game-potential-score': this.showPotentialScore,
        'toggle-history': this.showGameHistory
      })
    },
    
    updateTitle() {
      const server = this.$store.getters['settings/isLocalPlayOnline'] ? 'dev local' : 'fanserver'
      const base = this.onlineConnected ? ('FanCloisterZone Edition @ ' + server) /* + this.$store.state.onlineHostName */ : 'FanCloisterZone Edition' /* Fan Edition */

      // Multi-window debug indicator: role + gameId + local-server port + clientId tail.
      // If a game window shows [main], the --window-role argv detection failed (risk #2);
      // two windows sharing the same cid: confirm/diagnose the shared-clientId routing (risk #1).
      const parts = [this.$windows.role]
      const gameId = this.$store.state.game.id
      if (gameId) parts.push('game:' + String(gameId).slice(0, 8))
      const port = this.$server && this.$server.port
      if (port) parts.push('port:' + port)
      const clientId = this.$store.state.settings.clientId
      if (clientId) parts.push('cid:' + String(clientId).slice(-4))
      document.title = `${base}  [${parts.join(' ')}]`
    },

    async leaveGame () {
      if (this.onlineConnected) {
        const { $connection } = this
        const gameId = this.$store.state.game.id
        if (gameId) {
          if (this.$store.state.networking.connectionStatus === STATUS_CONNECTED) {
            $connection.send({ type: 'LEAVE_GAME', payload: { gameId } })
          }
        }
        // In a dedicated game window, leaving the game closes the window instead of showing a
        // lobby. Close WITHOUT navigating: routing to '/' first would re-render the game page
        // with cleared state (a red error flash) before the window tears down.
        if (this.$windows.isGameWindow()) { this.$store.dispatch('networking/close', { redirect: false }); this.$windows.closeSelf(); return }
        this.$router.push('/online')
      } else {
        const confirmed = await ipcRenderer.invoke('confirm-leave-game')
        if (!confirmed) return

        if (this.$windows.isGameWindow()) { this.$store.dispatch('game/close', { redirect: false }); this.$windows.closeSelf(); return }
        this.$store.dispatch('game/close')
        this.$router.push('/')
      }
    },

    onKeyDown (ev) {
      if (ev.key === '+') { // bind both + and numpad +
        this.$root.$emit('request-zoom', ZOOM_SENSITIVITY)
        return
      }
      if (ev.key === '-') {
        this.$root.$emit('request-zoom', -ZOOM_SENSITIVITY)
        return
      }
      if (ev.key === 'Escape') {
        this.$store.commit('board/pointsExpression', null)
        if (this.showAbout) {
          this.showAbout = false
          ev.preventDefault()
          ev.stopPropagation()
        }
      }
    },

    async dumpServer () {
      const data = {
        appVersion: getAppVersion(),
        engineVersion: this.$store.state.engine?.version,
        date: (new Date()).toISOString(),
        os: `${os.platform()} ${os.release()}`,
        ...(await this.$server.dump())
      }

      let { filePath } = await ipcRenderer.invoke('dialog.showSaveDialog', {
        title: 'Save Server Dump',
        filters: [{ name: 'JSON files', extensions: ['json'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })
      if (filePath) {
        if (extname(filePath) === '') {
          filePath += '.json'
        }
        fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
          if (err) {
            console.error(err)
          } else {
            console.log(`Dump save to ${filePath}`)
          }
        })
      }
    }
  }
}
</script>

<style lang="sass">
@import '@openfonts/roboto_latin-ext/index.css'
@import '~vuetify/src/styles/styles.sass'

@import '~/assets/styles/player-colors.scss'
@import '~/assets/styles/rotation.sass'

.scenario-path
  display: block
  margin-top: 8px
  padding: 8px 10px
  word-break: break-all
  font-size: 13px
  background: rgba(127, 127, 127, 0.15)
  border-radius: 4px

:root
  --aside-width: 290px
  --aside-width-plus-gap: #{290px + $panel-gap}
  --action-bar-height: 84px
  --game-setup-header-height: 72px

  @media #{map-get($display-breakpoints, 'lg-and-down')}
    --aside-width: 250px
    --aside-width-plus-gap: #{250px + $panel-gap}

  @media #{map-get($display-breakpoints, 'md-and-down')}
    --aside-width: 210px
    --aside-width-plus-gap: #{210px + $panel-gap}

  @media (max-height: 768px)
    --action-bar-height: 60px
    --game-setup-header-height: 50px

html
  overflow-y: auto

body
  margin: 0 !important

.view
  width: 100%
  min-height: 100vh

svg, g, use
  &.dragon, &.bigtop
    fill: $dragon-color

svg, g, use
  &.fairy
    fill: $fairy-color

svg, g, use
  &.count
    fill: $count-color

svg, g, use
  &.mage
    fill: $mage-color

svg, g, use
  &.witch
    fill: $witch-color

svg, g, use
  &.donkey
    fill: $donkey-color

  &.courier
    fill: $courier-color

.settings-dialog
  height: 80vh
  display: grid

#theme-resources, #symbols
  display: none

.top-bar
  position: absolute
  top: 0
  left: 0
  width: 100%
  z-index: 999

::-webkit-scrollbar
  width: 8px
  height: 8px

::-webkit-scrollbar-track
  background: #f0f0f0

::-webkit-scrollbar-thumb
  background: #555
  border-radius: 10px

::-webkit-scrollbar-thumb:hover
  background: #777
</style>
