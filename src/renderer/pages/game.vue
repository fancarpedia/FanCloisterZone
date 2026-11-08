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
      <v-menu v-if="isWeb && !showGameStats" offset-y content-class="web-menu-content">
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
      <!-- same collapsed class as the aside below: the deck counter sits directly above the
           player panels, so the two must share a width or the column looks broken -->
      <TilePackSize
        :class="{ 'supply-collapsed': !showPlayerSupply }"
        :size="tilePackSize"
        :removed-tiles-size="removedTilesSize"
        :game-key="$store.state.game.key"
        @click.native="tilePackOpen = !tilePackOpen"
      />
      <aside
        ref="aside"
        :class="{
          [`shrink-${shrink}`]: true,
          'active-player-indicator-bg-color': activePlayerIndicatorBgColor,
          'supply-collapsed': !showPlayerSupply
        }"
        @click="onAsideClick"
      >
        <!-- Small screens only (hidden by CSS above the breakpoint): expands the player panels
             from score + flowers to the full supply. Deliberately a child of the aside, exactly
             as .history-toggle lives inside .play-events — as a bare sibling of <aside> it
             rendered correctly but never received the click. -->
        <button
          class="supply-toggle"
          :title="showPlayerSupply ? $t('button.hide') : $t('button.show')"
          @click.stop="togglePlayerSupply"
        >
          <Meeple type="SmallFollower" />
          <v-icon x-small>{{ showPlayerSupply ? 'fa-chevron-right' : 'fa-chevron-left' }}</v-icon>
        </button>
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
import Meeple from '@/components/game/Meeple'
import PreDrawHand from '@/components/game/PreDrawHand.vue'

// How densely the player panels in the aside can be packed: 0 is roomy, MAX_SHRINK is tightest.
// Each level needs a matching `aside.shrink-N` rule in this file's styles.
const SHRINK_LEVELS = [0, 1, 2, 3]
const MAX_SHRINK = SHRINK_LEVELS[SHRINK_LEVELS.length - 1]

export default {
  components: {
    ActionPanel,
    Board,
    ChooseMonkOrAbbotDialog,
    FinalStats,
    GameChat,
    GlobalChat,
    GameSetupDialog,
    Meeple,
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
      showPlayerSupply: state => state.showPlayerSupply,
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
    // One remembered height per shrink level. Was three entries while the code indexed four,
    // so level 3 read back as `undefined` and could never be measured or loosened out of.
    this.shrinkSizes = SHRINK_LEVELS.map(() => null)
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
    // A named method rather than an inline $store.commit in the template: if the mutation name is
    // ever wrong, this fails loudly in one place instead of silently doing nothing on every click.
    togglePlayerSupply () {
      this.$store.commit('togglePlayerSupply')
    },

    // Tapping a PLAYER PANEL toggles the supply, so it is reachable even if the small toggle
    // button is awkward to hit. Only the panels: the aside is taller than the panels it holds,
    // and the variant banner sits in there too, so a click on that empty space used to collapse
    // the supply for no apparent reason. The one target inside an expanded panel that must keep
    // its own behaviour is a captured meeple (paying a ransom). The toggle button itself stops
    // propagation and calls the toggle directly.
    onAsideClick (ev) {
      const target = ev.target
      if (!target || !target.closest) {
        return
      }
      if (!target.closest('.player-panel') || target.closest('.item-prisoner')) {
        return
      }
      this.togglePlayerSupply()
    },

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

    // Single debounced entry point for everything that can change how much room the aside has:
    // a window resize, a layout change, or the aside's own content.
    scheduleCheckOverflow () {
      clearTimeout(this.checkOverflowTimeout)
      this.checkOverflowTimeout = setTimeout(this.checkOverflow, 20)
    },

    onRezize () {
      this.scheduleCheckOverflow()
    },

    checkOverflow () {
      const { aside } = this.$refs
      if (!aside) {
        return
      }

      if (!this._ro) {
        // The callback must not touch layout synchronously. Changing `shrink` re-renders the very
        // element being observed, and resizing an observed element from inside the callback is
        // exactly what makes the browser log "ResizeObserver loop limit exceeded" (and drop the
        // remaining notifications). Routing through the debounced entry point defers the work out
        // of the observer's delivery cycle and coalesces the burst a resize produces.
        this._ro = new ResizeObserver(() => this.scheduleCheckOverflow())
        this._ro.observe(aside)
      }

      const availableHeight = this.$el.clientHeight - aside.getBoundingClientRect().top
      // scrollHeight, not clientHeight: on small screens the aside is bounded top and bottom so it
      // can scroll, which makes clientHeight equal to the space available and the comparison below
      // can never fire — shrink froze at whatever level it was on. scrollHeight is the height the
      // panels actually want, so compressing is tried first and scrolling stays the fallback for
      // when even the densest level does not fit. On desktop the aside is content-sized, where the
      // two are the same, so this changes nothing there.
      const height = aside.scrollHeight
      const sizes = this.shrinkSizes

      // Remember how tall the aside is at this level, so we never loosen back into an overflow
      // and oscillate. A different height at a level we have already measured means the content
      // itself changed (a player gained tokens, a variant banner appeared), so every other
      // level's remembered height is stale too.
      if (sizes[this.shrink] == null) {
        sizes[this.shrink] = height
      } else if (sizes[this.shrink] !== height) {
        this.shrinkSizes = SHRINK_LEVELS.map(() => null)
        this.shrinkSizes[this.shrink] = height
        this.scheduleCheckOverflow()
        return
      }

      if (availableHeight < height && this.shrink < MAX_SHRINK) {
        this.shrink += 1
        this.scheduleCheckOverflow()
      } else if (availableHeight > height && this.shrink > 0) {
        const target = this.shrink - 1
        if (sizes[target] == null || sizes[target] <= availableHeight) {
          this.shrink = target
          this.scheduleCheckOverflow()
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
  // A mobile browser measures 100vh against the viewport with the URL bar HIDDEN, so while the
  // bar is showing the bottom of this element sits below what the player can actually see - and
  // everything anchored to it goes too, which is how the pre-draw hand ended up off screen.
  // `dvh` tracks the visible height instead. The 100vh line stays as the fallback for browsers
  // that do not know dvh, and on desktop (and in Electron, which has no URL bar) the two agree.
  height: 100vh
  height: 100dvh

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
  // On small screens the aside is bounded top AND bottom, so below the last player panel it is
  // an empty strip lying over the board: a touch there hit the aside instead of placing a tile.
  // Let the empty space fall through to the board and take the events back on the children that
  // are actually interactive. Clicks on those still bubble up to the aside's own handler, so
  // tapping a panel keeps toggling the supply, and dragging a panel still scrolls the list.
  pointer-events: none

  > *
    pointer-events: auto

  &.shrink-3
    top: calc(var(--action-bar-height) + 2px)

// Mirrors .history-toggle in PlayEvents.vue, on the opposite edge. Hidden above the breakpoint:
// there the aside always shows the full supply and there is nothing to expand.
.supply-toggle
  display: none

@media (max-width: $small-screen-max-width)
  // A row of its own at the top of the aside, not an overlay: as an absolutely-positioned pill it
  // sat on the first player's score. Still a child of the aside (that is what made it receive the
  // click at all), just in the flex flow, so it can never cover a panel.
  .supply-toggle
    align-self: flex-end
    margin-bottom: 4px
    // stays put while the panels scroll under it, like the history toggle
    position: sticky
    top: 0
    // The aside is a bounded flex column now, and a flex item's default flex-shrink: 1 lets the
    // browser squash items to avoid overflowing instead of scrolling. That made this pill shorter
    // in the expanded state (content overflows) than in the collapsed one (it fits).
    flex: none
    z-index: 6
    pointer-events: auto
    display: flex
    align-items: center
    gap: 3px
    height: 26px
    padding: 0 9px
    border: none
    border-radius: 13px 0 0 13px
    cursor: pointer
    background: rgba(0, 0, 0, 0.55)
    transition: background 0.15s

    &:hover
      background: rgba(0, 0, 0, 0.75)

    // ::v-deep because .meeple belongs to the Meeple child component — a scoped rule cannot
    // reach it. Without the size an <svg> with no width/height falls back to 300x150px, which
    // made this button enormous and pushed its real hit area off the screen edge.
    ::v-deep .meeple
      width: 16px
      height: 16px
      fill: #fff

    .v-icon
      color: #fff

// Small screens: the action bar spans the full width (ActionPanel.vue), so the deck counter can no
// longer sit beside it in the top-right corner — it moves directly below, and the player panels
// shift down by one bar height to keep clear of it. The aside's shrink logic measures its own
// getBoundingClientRect().top, so it adapts to the new offset on its own.
@media (max-width: $small-screen-max-width)
  .tile-pack-size
    top: var(--action-bar-height)

  aside
    top: calc(var(--action-bar-height) * 2 + #{$panel-gap})

    &.shrink-3
      top: calc(var(--action-bar-height) * 2 + 2px)

    // Collapsed, give the board the width back too: the panels hold only a score bullet and the
    // flowers, so the full --aside-width (210px) is mostly empty strip covering the board.
    //
    // auto rather than a fixed width, so the panel is exactly as wide as its content needs — and
    // flowers widen it instead of being clipped by the section's overflow: hidden.
    //
    // min-width leaves room for the toggle pill, which sits in the first panel's top-right corner.
    // Content alone settles at 65px (where the absolutely-positioned score bullet ends: it starts
    // at left:-25px and is 90px wide, the same 65px .player-tokens uses as its margin), and the
    // ~50px pill would then sit on top of that player's bullet.
    // Bounded top AND bottom, so the panels scroll instead of running off the screen with no way
    // to reach the last player. Desktop keeps its shrink-to-fit compression: there the aside has
    // no bottom, stays content-sized, and checkOverflow() picks a denser level. Here the height is
    // fixed by the two offsets, so that measurement settles and the overflow scrolls instead.
    bottom: $panel-gap
    overflow-y: auto
    // Vertical only. overflow-y: auto alone leaves overflow-x computing to auto, so anything a
    // panel pushes sideways produced a horizontal scrollbar. hidden pairs legally with auto (the
    // rule is only that `visible` cannot), and it does not crop the score bullet: the padding
    // below puts the bullet's overhang inside the box rather than outside it.
    overflow-x: hidden
    // keep a flick at the end of the list from scrolling the page/board behind it
    overscroll-behavior: contain
    // Room for the score bullet, which is absolutely positioned at left:-25px and overhangs each
    // panel. overflow-y: auto forces overflow-x to auto as well (CSS: once one axis is not
    // visible, the other cannot stay visible), so without this padding the scroll box crops the
    // bullet. The width grows to match, so the panels themselves keep their size — box-sizing is
    // border-box here, so padding would otherwise eat into them.
    padding-left: 25px
    width: calc(var(--aside-width) + 25px)

    &.supply-collapsed
      width: auto
      min-width: calc(120px + 25px)

  .tile-pack-size.supply-collapsed
    width: auto
    min-width: 120px
.game-modal
  position: absolute
  top: 0
  left: 0
  width: 100%
  // same reason as .game-view: 100vh overshoots the visible area while the URL bar is showing,
  // which would push the dialog's lower half out of reach
  height: 100vh
  height: 100dvh
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

<style lang="sass">
// The burger menu is the action bar's counterpart in the web build, so it speaks at the same
// size. v-menu teleports its content out of this page, which is why this block is NOT scoped
// and is keyed off the menu's content-class instead.
.web-menu-content
  // `dense` sizes the title at 13px through `.v-list--dense .v-list-item .v-list-item__title`,
  // which out-specifies a plainer selector - hence the full chain here.
  .v-list--dense .v-list-item .v-list-item__title
    font-size: $action-text-size
    line-height: 1.3

  // and give the larger type room rather than cropping it
  .v-list-item
    min-height: 48px

  // the icons keep their own `small` size - they read fine beside the larger label, and
  // Vuetify's .v-size--small would override anything set here anyway
  .v-list-item__icon
    margin-top: 12px
    margin-bottom: 12px
</style>
