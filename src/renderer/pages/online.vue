<template>
  <div class="online-page">
    <EngineAlerts />
    <AppUpdateBox />
    <header>
      <section class="button-group">
        <h3 class="group-title"><OnlineStatus /></h3>
        <div class="group-buttons">
          <v-btn :disabled="!connected" large color="primary" @click="createGame()">
            {{ $t('button.create-game') }}
          </v-btn>

          <v-btn :disabled="!connected" large color="primary" @click="openJoinGameDialog()">
            {{ $t('button.join-game') }}
          </v-btn>

          <v-btn v-if="connected" large color="secondary" @click="disconnect()">
            {{ $t('button.disconnect') }}
          </v-btn>
          <v-btn v-else large color="secondary" :loading="connecting" @click="connect()">
            {{ $t('button.connect') }}
          </v-btn>
        </div>
      </section>

      <span class="header-divider" />

      <!-- Local games run in their own window, independent of the online connection. -->
      <section class="button-group local-group">
        <h3 class="group-title">{{ $t('index.local.local-games') }}</h3>
        <div class="group-buttons">
          <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="newLocalGame()">
            {{ $t('index.local.new-game') }}
          </v-btn>

          <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="newLocalGameAI()">
            {{ $t('index.local.new-game-against-ai') }}
          </v-btn>

          <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="loadLocalGame()">
            {{ $t('index.local.open-game') }}
          </v-btn>
        </div>
      </section>
    </header>
    <div class="online-body">
    <main>
      <section class="splash">
        <img :src="splashImage()" />
      </section>

      <div v-if="!connected" class="empty-message offline-message">
        <p>
          <i>{{ $t('index.online.offline-lobby-hidden') }}</i>
        </p>
      </div>

      <div v-if="connected" class="lobby">
        <h2>{{ $t('index.online.lobby') }}</h2>

        <div v-if="!tilesLoaded" class="empty-message">
          <p>
            <i>{{ $t('index.online.loading-game-data') }}</i>
          </p>
        </div>

        <template v-else>
        <div v-if="!verifiedGamePublicList.length" class="empty-message">
          <p>
            <i>{{ $t('index.online.no-public-games') }}</i>
          </p>
        </div>

        <div class="game-list public">
          <div
            v-for="{ game, slots, valid, isOwner, isStarted, isOpen } in verifiedGamePublicList"
            :key="game.gameId + '#' + addonsReloadTick"
            class="game"
            :class="{ 'open-in-window': isOpen }"
          >
            <div v-if="isOpen" class="open-badge">{{ $t('index.online.opened-in-window') }}</div>
            <div v-if="game.name" class="game-name">
              {{ game.name }}
            </div>

            <div class="game-header">
              <span class="game-key">{{ game.key.substring(0,3) }}-{{ game.key.substring(3) }}</span>
              <span class="game-started">
                <span v-if="isStarted">
                  {{ formatDate(game.started) }}
                </span>
                <span v-if="!isStarted">
                  {{ $t('index.online.not-yet-started') }}
                </span>
              </span>
            </div>

            <div
              class="game-slots"
              :class="{ full: slots.length > 8 }"
            >
              <div
                v-for="s in slots"
                :key="s.number"
                :class="'game-slot color color-' + s.number + ' ' + ((s.clientId == clientId) ? 'local' : '') + ' ' + ((s.sessionId || s.clientId == clientId) ? '' : 'disconnected')"
                :title="s.name"
              >
                <div class="meeple">
                  <Meeple type="SmallFollower" />
                </div>
                <div class="name">
                  {{ s.name }}
                </div>
              </div>
            </div>

            <div :class="{ invalid: !valid }">
              <GameSetupOverviewInline :sets="game.setup.sets" :elements="game.setup.elements" />
            </div>

            <div class="buttons">
              <v-btn color="primary" :disabled="!valid || !connected" @click="resume(game)"><v-icon left>fa-play</v-icon> {{ $t('button.join-game') }}</v-btn>
              <v-btn color="secondary" :disabled="!isOwner || !connected" @click="del(game)"><v-icon>fa-trash-alt</v-icon></v-btn>
            </div>
          </div>
        </div>
        </template>
      </div>

      <div v-if="connected" class="games-in-progress">
        <h2>{{ $t('index.online.games-in-progress') }}</h2>

        <div v-if="!tilesLoaded" class="empty-message">
          <p>
            <i>{{ $t('index.online.loading-game-data') }}</i>
          </p>
        </div>

        <template v-else>
        <div v-if="!verifiedGameList.length" class="empty-message">
          <p>
            <i>{{ $t('index.online.you-have-no-game-in-progress') }}</i>
          </p>
        </div>

        <div class="game-list player">
          <div
            v-for="{ game, slots, valid, isOwner, isStarted, isOpen } in verifiedGameList"
            :key="game.gameId + '#' + addonsReloadTick"
            class="game"
            :class="{ 'open-in-window': isOpen }"
          >
            <div v-if="isOpen" class="open-badge">{{ $t('index.online.opened-in-window') }}</div>
            <div v-if="game.name" class="game-name">
              {{ game.name }}
            </div>

            <div class="game-header">
              <span class="game-key">{{ game.key.substring(0,3) }}-{{ game.key.substring(3) }}</span>
              <span class="game-started">
                <span v-if="isStarted">
                  {{ formatDate(game.started) }}
                </span>
                <span v-if="!isStarted">
                  {{ $t('index.online.not-yet-started') }}
                </span>
              </span>
            </div>

            <div
              class="game-slots"
              :class="{ full: slots.length > 8 }"
            >
              <div
                v-for="s in slots"
                :key="s.number"
                :class="'game-slot color color-' + s.number + ' ' + ((s.clientId == clientId) ? 'local' : '') + ' ' + ((s.sessionId || s.clientId == clientId) ? '' : 'disconnected')"
                :title="s.name"
              >
                <div class="meeple">
                  <Meeple type="SmallFollower" />
                </div>
                <div class="name">
                  {{ s.name }}
                </div>
              </div>
            </div>

            <div :class="{ invalid: !valid }">
              <GameSetupOverviewInline :sets="game.setup.sets" :elements="game.setup.elements" />
            </div>

            <div class="buttons">
              <v-btn color="primary" :disabled="!valid || !connected" @click="resume(game)"><v-icon left>fa-play</v-icon> {{ $t('button.resume') }}</v-btn>
              <v-btn color="secondary" :disabled="!isOwner || !connected" @click="del(game)"><v-icon>fa-trash-alt</v-icon></v-btn>
            </div>
          </div>
        </div>
        </template>
      </div>
    </main>

    <aside class="global-chat-aside">
      <h2>{{ $t('open-windows.title') }}</h2>
      <OpenGameWindows class="open-windows-block" />
      <h2>{{ $t('global-chat.title') }}</h2>
      <GlobalChat inline />
    </aside>
    </div>

    <v-dialog
      v-model="showDeleteDialog"
      persistent
      max-width="400px"
    >
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('index.online.abandon-game') }}</span>
        </v-card-title>
        <v-card-text>
          {{ $t('index.online.remove-unfinished-game-confirmation') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showDeleteDialog = false"
          >
            {{ $t('button.cancel') }}
          </v-btn>
          <v-btn
            text
            @click="delConfirm()"
          >
            {{ $t('button.remove') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="showJoinDialog"
      persistent
      max-width="400px"
    >
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('index.online.join-game') }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <p>{{ $t('index.online.paste-a-game-key') }}</p>
            <v-text-field ref="joinInput" v-model="joinGameId" :label="$t('index.online.game-id')" @keydown.enter="joinGame"  />
            <v-alert
              v-if="joinError"
              type="error"
              dense
            >
              {{ joinError }}
            </v-alert>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showJoinDialog = false">{{ $t('button.cancel') }}</v-btn>
          <v-btn text @click="joinGame">{{ $t('button.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="showAlertMessage"
      max-width="400px"
    >
      <v-card>
        <v-card-title>
          <span class="headline"></span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <p>{{ getAlertMessageText }}</p>
            <div
                v-for="link in getAlertMessageLinks"
              >
                <div><a :href="link.url" target="_blank">{{ link.title }}</a></div>
            </div>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="hideAlertMessage = true">{{ $t('button.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showLocalGameDialog" max-width="500px">
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('index.local.new-game') }}</span>
        </v-card-title>
        <v-card-text>
          {{ $t('index.online.online-storage-description') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showLocalGameDialog = false">{{ $t('button.cancel') }}</v-btn>
          <!-- Online games open in their own window which establishes its own connection (see
               connectForGame in layouts/default.vue), so this does not depend on the lobby being connected. -->
          <v-btn text color="primary" @click="confirmNewGame('online')">{{ $t('index.online.online-game') }}</v-btn>
          <v-btn text color="primary" @click="confirmNewGame('local')">{{ $t('index.online.local-game') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isNicknameDialogOpen" max-width="500px" persistent>
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('settings.player.nickname') }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <em>{{ $t('settings.player.nickname-description') }}</em>
            <v-text-field
              ref="nicknameInput"
              v-model="pendingNickname"
              :label="$t('settings.player.nickname')"
              :error-messages="nicknameError"
              class="mt-3"
              @keydown.enter="confirmNickname"
            />
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="isNicknameDialogOpen = false">{{ $t('button.cancel') }}</v-btn>
          <v-btn text color="secondary" @click="confirmNickname">{{ $t('button.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script>
import { mapState } from 'vuex'
import sortBy from 'lodash/sortBy'

import AddonsReloadObserverMixin from '@/components/AddonsReloadObserverMixin'
import GameSetupOverviewInline from '@/components/game-setup/overview/GameSetupOverviewInline'
import OnlineStatus from '@/components/OnlineStatus'
import Meeple from '@/components/game/Meeple'
import GlobalChat from '@/components/GlobalChat'
import OpenGameWindows from '@/components/OpenGameWindows'
import EngineAlerts from '@/components/EngineAlerts'
import AppUpdateBox from '@/components/AppUpdateBox'

import { STATUS_CONNECTED, STATUS_CONNECTING, STATUS_RECONNECTING } from '@/store/networking'

export default {
  components: {
    GameSetupOverviewInline,
    OnlineStatus,
    Meeple,
    GlobalChat,
    OpenGameWindows,
    EngineAlerts,
    AppUpdateBox
  },

  mixins: [
    AddonsReloadObserverMixin
  ],

  data () {
    return {
      // bumped whenever addons/tiles finish (re)loading, so game cards (validity +
      // GameSetupOverviewInline) refresh instead of staying stuck on pre-load "missing addon" data
      addonsReloadTick: 0,
      hideAlertMessage: false,
      showDeleteDialog: false,
      showDeleteGameId: null,
      showJoinDialog: false,
      joinGameId: '',
      joinError: null,
      autoConnectTried: false,
      showLocalGameDialog: false,
      isNicknameDialogOpen: false,
      pendingNickname: '',
      nicknameError: '',
      // open game windows (main-process registry) — used to mark game boxes already open in a window
      openWindows: []
    }
  },

  computed: {
    ...mapState({
      alertMessage: state => state.online.alertMessage,
      clientId: state => state.settings.clientId,
      gameList: state => state.online.gameList,
      gamePublicList: state => state.online.gamePublicList,
      playOnlineHostname: state => state.settings.playOnlineUrl.split('/')[0],
      locale: state => state.settings.locale,
      engine: state => state.engine,
      settingsLoaded: state => state.loaded.settings,
      tilesLoaded: state => state.loaded.tiles,
      connected: state => state.networking.connectionStatus === STATUS_CONNECTED,
      connecting: state => state.networking.connectionStatus === STATUS_CONNECTING || state.networking.connectionStatus === STATUS_RECONNECTING
    }),

    getAlertMessageLinks() {
      return this.alertMessage && this.alertMessage.message.links ? this.alertMessage.message.links : [];
    },
    getAlertMessageText() {
      return this.alertMessage && this.alertMessage.message.message ? this.alertMessage.message.message : '';
    },
    showAlertMessage: {
      get() {
        return this.alertMessage && this.alertMessage.message && !this.hideAlertMessage;
      },
      set(value) {
        // When dialog is dismissed (value goes false), set hideAlertMessage=true
        if (!value) {
          this.hideAlertMessage = true;
        }
      }
    },

    // gameIds already open in a game window of this app instance
    openGameIds () {
      return new Set(this.openWindows.map(w => w.gameId).filter(Boolean))
    },

    verifiedGameList () {
      return this.gameList.map(game => {
        const edition = game.setup.elements.garden ? 2 : 1
        const valid = !this.$tiles.getExpansions(game.setup.sets, edition)._UNKNOWN
        const slots = sortBy(game.slots.filter(s => s.clientId), 'order')
        const isOwner = game.owner === this.$store.state.settings.clientId
        const isStarted = !(game.started == null || game.started === '')
        const isOpen = this.openGameIds.has(game.gameId)
        return { game, valid, slots, isOwner, isStarted, isOpen }
      })
    },

    verifiedGamePublicList () {
      return this.gamePublicList.map(game => {
        const edition = game.setup.elements.garden ? 2 : 1
        const valid = !this.$tiles.getExpansions(game.setup.sets, edition)._UNKNOWN
        const slots = sortBy(game.slots.filter(s => s.clientId), 'order')
        const isOwner = game.owner === this.$store.state.settings.clientId
        const isStarted = !(game.started == null || game.started === '')
        const isOpen = this.openGameIds.has(game.gameId)
        return { game, valid, slots, isOwner, isStarted, isOpen }
      })
    }
  },

  mounted () {
    if (this.connected) {
      this.sendGameLists()
    } else {
      // /online is the default lobby screen: instead of bouncing home when offline, try to
      // connect automatically (silently) and stay here.
      this.maybeAutoConnect()
    }
    // Games are created/started in their own windows: refresh the lists whenever the user
    // comes back to this lobby window, or a freshly created game never shows up in them.
    this._onWindowFocus = () => { if (this.connected) this.sendGameLists() }
    window.addEventListener('focus', this._onWindowFocus)
    // track open game windows to mark game boxes that are already open in one
    this.$windows.listGameWindows().then(list => { this.openWindows = list })
    this._unsubscribeWindows = this.$windows.onWindowsChanged(list => { this.openWindows = list })
  },

  beforeDestroy () {
    this._onClose && this.$connection.off('close', this._onClose)
    this._onWindowFocus && window.removeEventListener('focus', this._onWindowFocus)
    this._unsubscribeWindows && this._unsubscribeWindows()
  },

  watch: {
    // Settings (and therefore the nickname) load asynchronously at startup, so the initial
    // mount may run before they are ready. Retry the auto-connect once they arrive.
    settingsLoaded () {
      this.maybeAutoConnect()
    },

    // The engine is probed asynchronously at startup; retry the auto-connect once it's ready
    // (its version is part of the connect handshake).
    engine () {
      this.maybeAutoConnect()
    },

    // Auto-connect finishes after this component is already mounted, so refresh the lobby the
    // moment the connection goes live.
    connected (val) {
      if (val) {
        this.sendGameLists()
      }
    },

    alertMessage: {
      handler(newVal) {
        // When a new message arrives, show dialog
        if (newVal && newVal.message) {
          this.hideAlertMessage = false;
        }
      },
      deep: true
    }
  },

  methods: {
    // Called by AddonsReloadObserverMixin when $tiles / $theme finish loading — force the game
    // lists to re-render so validity and the setup overview reflect the now-loaded addons.
    afterAddonsReloaded () {
      this.addonsReloadTick++
    },

    sendGameLists () {
      this.$connection.send({ type: 'LIST_GAMES', payload: {} })
      this.$connection.send({ type: 'LIST_PUBLIC_GAMES', payload: {} })
    },

    splashImage () {
      const theme = this.$vuetify.theme.dark ? 'dark' : 'light'
      return require(`@/assets/splash_${theme}.png`)
    },

    maybeAutoConnect () {
      if (this.autoConnectTried) return
      if (this.$store.state.networking.userDisconnected) return // the user pressed Disconnect — stay offline
      if (!this.settingsLoaded) return // wait for the nickname to load
      if (!this.engine) return // wait until the engine is probed (its version is sent on connect)
      if (this.connected || this.connecting) return
      if (this.$store.state.networking.connectionType === 'online') return
      const nickname = this.$store.state.settings.nickname
      // Connect automatically only when a nickname is set; otherwise stay offline and let the
      // user connect explicitly (which prompts for one).
      if (!nickname || !nickname.trim()) return
      this.autoConnectTried = true
      this.$store.dispatch('networking/connectPlayOnlineFan', { silent: true })
    },

    connect () {
      const nickname = this.$store.state.settings.nickname
      if (!nickname || !nickname.trim()) {
        this.pendingNickname = nickname || ''
        this.nicknameError = ''
        this.isNicknameDialogOpen = true
        this.$nextTick(() => {
          this.$refs.nicknameInput && this.$refs.nicknameInput.focus()
        })
        return
      }
      this.autoConnectTried = true
      this.$store.dispatch('networking/connectPlayOnlineFan')
    },

    async confirmNickname () {
      const trimmed = this.pendingNickname.trim()
      if (!trimmed) {
        this.nicknameError = this.$t('core-messages.field-is-required', {
          field: this.$t('settings.player.nickname')
        })
        return
      }
      this.nicknameError = ''
      await this.$store.dispatch('settings/update', { nickname: trimmed })
      this.isNicknameDialogOpen = false
      this.autoConnectTried = true
      this.$store.dispatch('networking/connectPlayOnlineFan')
    },

    createGame () {
      const fan = this.$store.state.networking.onlineEntry !== 'plain'
      if (this.$windows.openGame({ kind: 'create-online', payload: { fan } })) return
      this.$store.dispatch('gameSetup/newGame')
      this.$router.push('/game-setup')
    },

    // Local games open in their own window and don't disturb this lobby's online connection.
    newLocalGame () {
      this.showLocalGameDialog = true
    },

    confirmNewGame (kind) {
      this.showLocalGameDialog = false
      if (kind === 'online') {
        this.createGame()
        return
      }
      if (this.$windows.openGame({ kind: 'new-local' })) return
      this.$store.dispatch('gameSetup/newGame')
      this.$router.push('/game-setup')
    },

    newLocalGameAI () {
      if (this.$windows.openGame({ kind: 'new-local', payload: { ai: true } })) return
      this.$store.dispatch('gameSetup/newGameAI')
      this.$router.push('/game-setup')
    },

    async loadLocalGame () {
      const file = await this.$store.dispatch('game/chooseSaveFile')
      if (!file) return
      if (this.$windows.openGame({ kind: 'load', payload: { file } })) return
      this.$store.dispatch('game/load', { file })
    },

    formatDate(date) {
      return new Date(date).toLocaleString(this.locale);
    },
    
    openJoinGameDialog () {
      this.joinGameId = ''
      this.showJoinDialog = true
      setTimeout(() => {
        this.$refs.joinInput.focus()
      }, 1)
    },

    joinGame () {
      // already open in a game window (match by game key) → focus it instead of a second window
      const norm = k => (k || '').replace(/-/g, '').toLowerCase()
      const openWin = this.openWindows.find(w => w.key && norm(w.key) === norm(this.joinGameId))
      if (openWin) {
        this.$windows.focusGameWindow(openWin.id)
        this.showJoinDialog = false
        return
      }
      const fan = this.$store.state.networking.onlineEntry !== 'plain'
      if (this.$windows.openGame({ kind: 'join-online', payload: { gameKey: this.joinGameId, fan } })) {
        this.showJoinDialog = false
        return
      }
      this.joinError = null
      this.$connection.onNextSendError(err => {
        this.joinError = err.message
      })
      this.$connection.send({ type: 'JOIN_GAME', payload: { gameKey: this.joinGameId } })
    },

    disconnect () {
      // close() keeps the lobby window on /online in offline state; no navigation needed.
      // userIntent suppresses the auto-connect from re-firing right after.
      this.$store.dispatch('networking/close', { userIntent: true })
    },

    resume (game) {
      // the game is already open in a game window → bring THAT window to the front
      // instead of opening a second window for the same game
      const openWin = this.openWindows.find(w => w.gameId === game.gameId)
      if (openWin) {
        this.$windows.focusGameWindow(openWin.id)
        return
      }
      const fan = this.$store.state.networking.onlineEntry !== 'plain'
      if (this.$windows.openGame({ kind: 'join-online', payload: { gameId: game.gameId, fan } })) return
      this.$connection.send({ type: 'JOIN_GAME', payload: { gameId: game.gameId } })
    },

    del (game) {
      this.showDeleteDialog = true
      this.showDeleteGameId = game.gameId
    },

    async delConfirm () {
      this.showDeleteDialog = false
      await this.$connection.send({ type: 'ABANDON_GAME', payload: { gameId: this.showDeleteGameId } })
      await this.$connection.send({ type: 'LIST_GAMES', payload: {} })
      await this.$connection.send({ type: 'LIST_PUBLIC_GAMES', payload: {} })
    }
  }
}
</script>

<style lang="sass" scoped>
*
  user-select: none

.online-page
  height: 100vh
  display: flex
  flex-direction: column
  overflow: hidden

  +theme using ($theme)
    background: map-get($theme, 'board-bg')

header
  padding: 8px 0 12px
  display: flex
  align-items: stretch
  justify-content: center

  +theme using ($theme)
    background-color: map-get($theme, 'cards-bg')
    color: map-get($theme, 'gray-text-color')

  .button-group
    display: flex
    flex-direction: column
    align-items: center
    gap: 6px
    padding: 6px 16px 10px
    border-radius: 8px

    // local games are a separate world from the server connection — tint them apart
    &.local-group
      +theme using ($theme)
        background: map-get($theme, 'board-bg')

    .group-title
      font-size: 14px
      font-weight: 300
      text-transform: uppercase
      margin: 0

      // OnlineStatus text used as the group title — flatten its own bar styling
      ::v-deep .online-status
        background: none !important
        font-size: 14px
        text-transform: uppercase

    .group-buttons
      display: flex
      align-items: center

  .v-btn
    margin: 0 15px

  .header-divider
    align-self: stretch
    width: 1px
    margin: 4px 8px
    opacity: 0.25

    +theme using ($theme)
      background-color: map-get($theme, 'gray-text-color')

h2
  font-weight: 300
  font-size: 16px
  text-transform: uppercase
  text-align: center
  margin-top: 30px

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.game-list
  padding: 0 20px
  display: flex
  flex-wrap: wrap

  &.player
    +theme using ($theme)
      background-color: map-get($theme, 'cards-bg')
      color: map-get($theme, 'gray-text-color')

.game
  width: 380px
  padding: 20px 10px
  margin: 10px
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.15), 0 3px 10px 0 rgba(0, 0, 0, 0.10)

  // already open in a game window of this app — outlined + labelled
  &.open-in-window
    outline: 2px solid var(--v-primary-base)
    position: relative

    .open-badge
      position: absolute
      top: -1px
      right: -1px
      padding: 2px 10px
      border-radius: 0 0 0 6px
      font-size: 11px
      font-weight: 600
      text-transform: uppercase
      letter-spacing: 0.5px
      color: white
      background: var(--v-primary-base)

  .invalid
    opacity: 0.4

  .buttons
    margin: 0 6px

    .v-btn
      margin-right: 10px

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: map-get($theme, 'cards-bg')

  .game-name
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    margin: -8px 8px 6px

    +theme using ($theme)
      color: map-get($theme, 'text-color')

  .game-header
    display: flex
    justify-content: space-between
    margin: -8px 8px 6px
    font-weight: 300
    font-size: 16px
    text-transform: uppercase

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  .game-slots
    display: flex
    margin: 0 8px 12px
    gap: 4px
    min-height: 43px

    &.full
      margin: 0 4px 12px

  .game-slot
    /* must not grow/shrink and must provide a positioning context */
    flex: 0 0 auto
    position: relative
    width: 36px
    height: 60px
    display: inline-block
    align-items: center
    justify-content: center
    overflow: hidden

    /* keep meeple size consistent */
    svg.meeple
      width: 36px
      height: 36px
      display: block

    &.local
      font-weight: bolder
      
      +theme using ($theme)
        color: map-get($theme, 'local-player-color')
      
    &.disconnected
      
      svg.meeple 
        fill: white
        
        +theme using ($theme)
          filter: map-get($theme, 'disconnected-filter')

.splash
  height: 25vh
  display: flex
  justify-content: center
  align-items: center

  img
    max-width: 600px

.empty-message
  margin: 30px 0
  text-align: center

.online-body
  flex: 1 1 auto
  min-height: 0
  display: flex
  overflow: hidden

  main
    flex: 1 1 auto
    min-width: 0
    overflow-y: auto

.global-chat-aside
  flex: 0 0 340px
  height: 100%
  display: flex
  flex-direction: column
  padding: 16px 16px 20px
  box-sizing: border-box
  overflow: hidden

  +theme using ($theme)
    background-color: map-get($theme, 'cards-bg')

  h2
    margin-top: 0
    flex: 0 0 auto

    & ~ h2
      margin-top: 20px

  .open-windows-block
    flex: 0 0 auto
    max-height: 35%
    margin-bottom: 4px

  ::v-deep .global-chat-root
    flex: 1 1 0
    min-height: 0
    display: flex

@media (max-width: 919px)
  .online-body
    flex-direction: column

  .global-chat-aside
    flex: 0 0 340px
    width: 100%
    height: 340px
</style>
