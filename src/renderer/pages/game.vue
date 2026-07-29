<template>
  <div class="view game-view">
    <template v-if="phase">
      <div v-if="forcedDraw" class="forced-draw">
        {{ $t('dev.game-created-in-development-mode') }}<br />
        {{ $t('dev.tile-draw-order-is-predefined') }}
      </div>
      <TestResult v-if="testScenarioResult" :result="testScenarioResult" />
      <Board />
      <!-- web build has no native menu / window chrome, so surface an in-view burger menu;
           hidden once the final score is up (that screen has its own controls) -->
      <v-menu v-if="isWeb && !showGameStats" offset-y>
        <template #activator="{ on, attrs }">
          <div class="web-menu" v-bind="attrs" :title="$t('menu.session')" v-on="on">
            <v-icon>fas fa-bars</v-icon>
          </div>
        </template>
        <v-list dense>
          <v-list-item @click="openSettings">
            <v-list-item-icon><v-icon small>fas fa-cog</v-icon></v-list-item-icon>
            <v-list-item-title>{{ $t('menu.settings') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="leave">
            <v-list-item-icon><v-icon small>fas fa-house</v-icon></v-list-item-icon>
            <v-list-item-title>{{ $t('menu.home') }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <TilePackSize
        :size="tilePackSize"
        :removed-tiles-size="removedTilesSize"
        :game-key="$store.state.game.key"
        @click.native="tilePackOpen = !tilePackOpen"
      />
      <aside
        ref="aside"
        :class="{
          [`shrink-${shrink}`]: true,
          'active-player-indicator-bg-color': activePlayerIndicatorBgColor
        }"
      >
        <!-- variant banner sits between the deck counter (above) and the player panels (below) -->
        <div v-if="gameVariant" class="game-variant" :title="$t('game-setup.variant.choose-variant')">{{ gameVariant }}</div>
        <PlayerPanel
          v-for="({player, index}) in orderedPlayers"
          :key="index"
          :index="index"
          :player="player"
        />
      </aside>
      <ActionPanel
        :phase="phase"
        :action="action"
      />
      <PreDrawHand />
      <PlayEvents />
      <GameChat />
      <!-- Single-window web replaces the online lobby when a game starts, so surface the lobby-wide
           global chat here too (floating bullet). Self-hides when not connected online. Web only —
           on desktop the lobby lives in its own window. Offset left of the red GameChat button
           (which sits at aside-width + 16px) so the two bullets don't overlap. -->
      <GlobalChat v-if="isWeb" right="calc(var(--aside-width-plus-gap) + 84px)" />
      <FinalStats v-if="showGameStats" />
      <div
        v-if="gameDialog"
        class="game-modal"
      >
        <div class="game-modal-content">
          <ChooseMonkOrAbbotDialog
            v-if="gameDialog.type === 'monk-or-abbot'"
            v-bind="gameDialog.attrs"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <v-row justify="center" align="center">
        <v-progress-circular indeterminate />
      </v-row>
    </template>

    <v-dialog
      v-model="tilePackOpen"
      max-width="800"
    >
      <TilePackDialog @close="tilePackOpen = false" />
    </v-dialog>

    <v-dialog
      v-model="showGameSetup"
      max-width="800"
    >
      <GameSetupDialog @close="showGameSetup = false" />
    </v-dialog>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { ipcRenderer } from 'electron'

import { isWeb } from '@/utils/version'
import ActionPanel from '@/components/game/ActionPanel.vue'
import Board from '@/components/game/Board.vue'
import FinalStats from '@/components/game/FinalStats.vue'
import GameChat from '@/components/game/GameChat.vue'
import GlobalChat from '@/components/GlobalChat'
import ChooseMonkOrAbbotDialog from '@/components/game/dialogs/ChooseMonkOrAbbotDialog.vue'
import PlayerPanel from '@/components/game/PlayerPanel.vue'
import PlayEvents from '@/components/game/PlayEvents.vue'
import TestResult from '@/components/game/TestResult.vue'
import TilePackDialog from '@/components/game/dialogs/TilePackDialog.vue'
import TilePackSize from '@/components/game/TilePackSize.vue'
import GameSetupDialog from '@/components/game/dialogs/GameSetupDialog.vue'
import PreDrawHand from '@/components/game/PreDrawHand.vue'

export default {
  components: {
    ActionPanel,
    Board,
    ChooseMonkOrAbbotDialog,
    FinalStats,
    GameChat,
    GlobalChat,
    GameSetupDialog,
    PlayerPanel,
    PlayEvents,
    PreDrawHand,
    TestResult,
    TilePackDialog,
    TilePackSize
  },

  data () {
    return {
      shrink: 0,
      showFinalStats: true,
      isWeb: isWeb()
    }
  },

  computed: {
    ...mapState({
      action: state => state.game.action,
      activePlayerIdx: state => state.game.action?.player,
      gameDialog: state => state.gameDialog,
      online: state => state.networking.connectionType === 'online',
      phase: state => state.game.phase,
      players: state => state.game.players,
      tilePackSize: state => state.game.tilePack.size,
      removedTilesSize: state => state.game.discardedTiles.length,
      testScenarioResult: state => state.game.testScenarioResult,
      forcedDraw: state => {
//        if (process.env.NODE_ENV === 'development') {
//          return false
//        }
        const { drawOrder, endTurn } = state.game.gameAnnotations
        return !!(drawOrder || endTurn)
      },
      gameHash: state => state.game.hash,
      playerListRotate: state => state.settings.playerListRotate,
      activePlayerIndicatorBgColor: state => state.settings.activePlayerIndicatorBgColor,
      showGameStats: state => state.game.showGameStats,
      setup: state => state.game.setup
    }),

    ...mapGetters({
      localPlayers: 'game/localPlayers'
    }),

    // in-game variant label shown next to the deck counter; null for the standard game
    gameVariant () {
      return this.setup?.elements?.['keep-building']
        ? this.$t('game.feature.keep-building')
        : null
    },

    orderedPlayers () {
      const players = this.players.map((player, index) => ({ player, index }))

      if (this.playerListRotate === 'active-on-top' && this.activePlayerIdx) {
        const n = this.activePlayerIdx
        return [...players.slice(n, players.length), ...players.slice(0, n)]
      }

      if (this.playerListRotate === 'local-on-top' && this.localPlayers.length) {
        const n = this.localPlayers[0]
        return [...players.slice(n, players.length), ...players.slice(0, n)]
      }

      return players
    },

    tilePackOpen: {
      get () {
        return this.$store.state.showGameTiles
      },

      set (value) {
        this.$store.commit('showGameTiles', value)
      }
    },

    showGameSetup: {
      get () {
        return this.$store.state.showGameSetup
      },

      set (value) {
        this.$store.commit('showGameSetup', value)
      }
    }
  },

  watch: {
    phase (newVal, oldVal) {
      if (!oldVal) {
        this.checkOverflow()
      }
    },

    activePlayerIdx (val) {
      this.setPlayer(val)
    }
  },

  beforeCreate () {
    // useful for dev mode, reload on this page redirects back to home
    if (!this.$store.state.networking.connectionType) {
      this.$store.dispatch('game/close')
      this.$router.push('/')
    }
  },

  mounted () {
    this.shrinkSizes = [null, null, null]
    this.shrinkChanged = false
    window.addEventListener('resize', this.onRezize)
    this.checkOverflow()
    this.setPlayer(this.activePlayerIdx)
    this.gameId = this.$store.state.game.id
    if (this.$store.state.networking.connectionType == 'direct' ) {
      ipcRenderer.send('set-local-game', true)
    }

    // Disallow BROWSER page zoom while in the game view — the board has its own zoom (wheel / pinch),
    // and page zoom on mobile just breaks the fixed full-screen layout. Blocks ctrl/⌘+wheel, the
    // Safari pinch "gesture" events, ctrl/⌘ +/-/0 keys, and multi-touch pinch. The board's own zoom
    // uses plain wheel + pointer events, so it is unaffected.
    this._onWheelZoom = (e) => { if (e.ctrlKey) e.preventDefault() }
    this._onGesture = (e) => e.preventDefault()
    this._onKeyZoom = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault()
    }
    this._onPinch = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault() }
    window.addEventListener('wheel', this._onWheelZoom, { passive: false })
    window.addEventListener('gesturestart', this._onGesture)
    window.addEventListener('gesturechange', this._onGesture)
    window.addEventListener('gestureend', this._onGesture)
    window.addEventListener('keydown', this._onKeyZoom)
    window.addEventListener('touchmove', this._onPinch, { passive: false })
  },

  beforeDestroy () {
    this._ro?.disconnect()
    window.removeEventListener('resize', this.onRezize)
    clearTimeout(this.checkOverflowTimeout)
    window.removeEventListener('wheel', this._onWheelZoom)
    window.removeEventListener('gesturestart', this._onGesture)
    window.removeEventListener('gesturechange', this._onGesture)
    window.removeEventListener('gestureend', this._onGesture)
    window.removeEventListener('keydown', this._onKeyZoom)
    window.removeEventListener('touchmove', this._onPinch)
    this.setPlayer(null)
    if (this.gameId === this.$store.state.game.id) {
      // close only if not already closed (eg by Play Again button )
      this.$store.dispatch('game/close')
    }
    this.$store.commit('showGameTiles', false)
    this.$store.commit('showGameSetup', false)
    ipcRenderer.send('set-local-game', false)
  },

  methods: {
    leave () {
      // reuse the layout's leaveGame flow (online LEAVE_GAME / offline confirm + close + redirect);
      // default.vue listens on this channel, and the electron stub's emit() delivers it on web too
      ipcRenderer.emit('menu.leave-game')
    },

    openSettings () {
      this.$store.commit('showSettings', true)
    },

    setPlayer (idx) {
      this.setPlayerIcon(idx)
    },
    setPlayerIcon (idx) {
      let icon
      if (Number.isInteger(idx)) {
        const slot = this.$store.state.game.players[idx].slot
        icon = `p${slot}.ico`
      } else {
        icon = 'default.ico'
      }
      ipcRenderer.invoke('win.setIcon', icon)
    },

    onRezize () {
      clearTimeout(this.checkOverflowTimeout)
      this.checkOverflowTimeout = setTimeout(this.checkOverflow, 20)
    },

    checkOverflow () {
      const { aside } = this.$refs
      if (!aside) {
        return
      }

      if (!this._ro) {
        this._ro = new ResizeObserver(ev => {
          if (this.shrinkChanged) {
            // triggered from checkOverflow
            this.shrinkChanged = false
          } else {
            // triggered by changed content
            this.shrinkSizes = [null, null, null, null]
            this.checkOverflow()
          }
        })
        this._ro.observe(aside)
      }

      const availableHeight = this.$el.clientHeight - aside.getBoundingClientRect().top
      const height = aside.clientHeight
      const sizes = this.shrinkSizes

      if (sizes[this.shrink] === null) {
        sizes[this.shrink] = height
      }

      if (availableHeight < height && this.shrink < 3) {
        this.shrink += 1
        this.shrinkChanged = true
        setTimeout(this.checkOverflow, 1)
      }
      if (availableHeight > height && this.shrink > 0) {
        const target = this.shrink - 1
        if (sizes[target] === null || sizes[target] <= availableHeight) {
          this.shrink = target
          this.shrinkChanged = true
          setTimeout(this.checkOverflow, 1)
        }
      }
    }
  }
}
</script>

<style lang="sass" scoped>
*
  user-select: none

.game-view
  position: relative
  display: flex
  overflow: hidden
  height: 100vh

  .forced-draw, .test-result
    position: absolute
    top: calc(var(--action-bar-height) + #{$panel-gap})
    right: var(--aside-width-plus-gap)

  .forced-draw
    padding: 5px
    background-color: #AD1457
    color: white
    font-weight: 600

.board
  flex: 1
  +theme using ($theme)
    background: map-get($theme, 'board-bg')

.tile-pack-size
  position: absolute
  top: 0
  right: 0
  width: var(--aside-width)
  height: var(--action-bar-height)
  cursor: pointer

  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')

.game-variant
  display: flex
  align-items: center
  justify-content: center
  width: 100%
  padding: 4px 12px
  margin-bottom: $panel-gap
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.5px
  white-space: nowrap
  text-align: center

  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')
    color: var(--v-primary-base)

.web-menu
  position: absolute
  top: $panel-gap
  right: $panel-gap
  z-index: 3
  display: flex
  align-items: center
  justify-content: center
  width: 40px
  height: 40px
  border-radius: 6px
  cursor: pointer
  color: white
  background: var(--v-primary-base)
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3)

  &:hover
    filter: brightness(1.1)

  .v-icon
    color: white
    font-size: 22px

aside
  position: absolute
  top: calc(var(--action-bar-height) + #{$panel-gap})
  right: 0
  width: var(--aside-width)
  user-select: none
  display: flex
  flex-direction: column
  z-index: 2

  &.shrink-3
    top: calc(var(--action-bar-height) + 2px)

.game-modal
  position: absolute
  top: 0
  left: 0
  width: 100%
  height: 100vh
  background: rgba(255, 255, 255, 0.8)
  z-index: 99
  display: flex
  align-items: center
  justify-content: center

  .game-modal-content
    position: relative
    box-shadow: 0px 0px 4px 0px rgba(0,0,0,0.45)
    padding: 40px 60px

    +theme using ($theme)
      color: map-get($theme, 'cards-text')
      background: map-get($theme, 'cards-bg')
</style>
