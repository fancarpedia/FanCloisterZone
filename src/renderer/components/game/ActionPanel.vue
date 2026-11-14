<template>
  <div
    :class="['action-panel', { 'full-height': pointsExpression || phase === 'GameOverPhase', 'two-lines': twoLines, web: isWeb }, activePlayerPanelColorClass]"
    @click.right="onRightClick"
  >
    <div v-if="notifyConnectionClosed" class="flex-grow-1">
      <v-alert type="error">
        {{ $t('game.action.host-terminated-the-game') }}
      </v-alert>
    </div>
    <PointsExpression
      v-else-if="pointsExpression"
      :expr="pointsExpression"
    />
    <ReturnedMeeplePanel
      v-else-if="returnedMeeplePanel"
      :expr="returnedMeeplePanel"
    />
    <AwardedMeeplePanel
      v-else-if="awardedMeeplePanel"
      :expr="awardedMeeplePanel"
    />
    <ReturnedTokenPanel
      v-else-if="returnedTokenPanel"
      :expr="returnedTokenPanel"
    />
    <DiceRollPanel
      v-else-if="diceRollPanel"
      :expr="diceRollPanel"
    />
    <PlacementPanel
      v-else-if="placementPanel"
      :expr="placementPanel"
    />
    <!-- use v-show bit v-if for pointsExoression - to not hide related layers when pointExpression is triggered by mouse hover  -->
    <component
      :is="actionComponent"
      v-if="action"
      v-show="!pointsExpression && !notifyConnectionClosed && !returnedMeeplePanel && !awardedMeeplePanel && !returnedTokenPanel && !diceRollPanel && !placementPanel"
      :action="action"
      :phase="phase"
      :local="local && !ai"
      @two-lines="twoLines = $event"
    >
      <template
        v-if="action.canPass || undoAllowed || canRotatePlacedTile"
        #default="{ label }"
      >
        <!-- the action panel shows actions and buttons only: no "or" / "or skip action" texts -->
        <template v-if="local && !ai">
          <template v-if="action.canPass">
            <div class="pass-item">
              <ActionButton
                :large="$vuetify.breakpoint.height > 768"
                color="secondary"
                :icon="label ? 'fa-check' : 'fa-forward'"
                :label="label || $t('game.action.skip-action')"
                @click="pass"
              />
            </div>
          </template>
          <!-- Turn the tile that is already on the board. Small screens only: with no R key the
               alternative is undo, re-rotate, re-place. Offered in every phase that can still be
               reached with the tile uncommitted - ActionPhase, TilePlacementConfirmPhase,
               GoldPiecePhase and MageAndWitchPhase all render this slot - and withdrawn as soon
               as the engine raises TILE_ROTATION_DISALLOWED (see canRotatePlacedTile). -->
          <template v-if="canRotatePlacedTile">
            <div class="pass-item rotate-placed">
              <ActionButton
                :large="$vuetify.breakpoint.height > 768"
                icon="fa-sync-alt"
                :label="$t('menu.rotate')"
                @click="rotatePlacedTile"
              />
            </div>
          </template>
          <!-- undo (e.g. take back the tile placement / a wrong meeple choice); on mobile/web this
               is the only way to undo — there is no keyboard shortcut or native menu -->
          <template v-if="undoAllowed">
            <div class="pass-item">
              <ActionButton
                :large="$vuetify.breakpoint.height > 768"
                icon="fa-undo"
                :label="$t('button.undo')"
                @click="undo"
              />
            </div>
          </template>
        </template>
      </template>
    </component>

    <GameResultPanel
      v-else-if="phase === 'GameOverPhase'"
      v-show="!pointsExpression && !returnedMeeplePanel && !awardedMeeplePanel && !returnedTokenPanel && !diceRollPanel && !placementPanel"
      class="game-over"
    />

    <svg
      v-if="showActivePlayerIndicator"
      :class="`active-player-marker ${colorCssClass(action.player)} color-fill`"
      width="42" height="42"
    >
      <polygon points="0,0 42,0 42,42" />
    </svg>

    <audio
      ref="beep"
      :src="BEEP_URL"
    />
  </div>
</template>

<script>
import { ipcRenderer } from 'electron'
import { mapGetters, mapState } from 'vuex'

import ActionButton from '@/components/game/actions/ActionButton'
import ActionPhaseAction from '@/components/game/actions/ActionPhaseAction.vue'
import BazaarPhaseAction from '@/components/game/actions/BazaarPhaseAction.vue'
import CastlePhaseAction from '@/components/game/actions/CastlePhaseAction.vue'
import CocCountPhaseAction from '@/components/game/actions/CocCountPhaseAction.vue'
import CornCircleChoice from '@/components/game/actions/CornCircleChoice.vue'
import CornCircleReturn from '@/components/game/actions/CornCircleReturn.vue'
import CommitActionPhaseAction from '@/components/game/actions/CommitActionPhaseAction.vue'
import PlacementPanel from '@/components/game/PlacementPanel.vue'
import DiceRollPanel from '@/components/game/DiceRollPanel.vue'
import DragonMovePhaseAction from '@/components/game/actions/DragonMovePhaseAction.vue'
import EscapePhaseAction from '@/components/game/actions/EscapePhaseAction.vue'
import FerryPhaseAction from '@/components/game/actions/FerryPhaseAction.vue'
import GameResultPanel from '@/components/game/GameResultPanel.vue'
import GoldPiecePhaseAction from '@/components/game/actions/GoldPiecePhaseAction.vue'
import PointsExpression from '@/components/game/PointsExpression.vue'
import RemoveMageOrWitchAction from '@/components/game/actions/RemoveMageOrWitchAction.vue'
import AwardedMeeplePanel from '@/components/game/AwardedMeeplePanel.vue'
import ReturnedMeeplePanel from '@/components/game/ReturnedMeeplePanel.vue'
import ReturnedTokenPanel from '@/components/game/ReturnedTokenPanel.vue'
import SelectPrisonerToExchangeAction from '@/components/game/actions/SelectPrisonerToExchangeAction.vue'
// resolved by name ("ScoringPhase" + "Action") while scoring waits for SCORE_FIRST
import ScoringPhaseAction from '@/components/game/actions/ScoringPhaseAction.vue'
import ShepherdPhaseAction from '@/components/game/actions/ShepherdPhaseAction.vue'
import ShepherdPlacementConfirmPhaseAction from '@/components/game/actions/ShepherdPlacementConfirmPhaseAction.vue'
import TilePhaseAction from '@/components/game/actions/TilePhaseAction.vue'
import TilePlacementConfirmPhaseAction from '@/components/game/actions/TilePlacementConfirmPhaseAction.vue'
import TowerCapturePhaseAction from '@/components/game/actions/TowerCapturePhaseAction.vue'
import { isWeb } from '@/utils/version'

const MAPPING = {
  AbbeyEndGamePhase: TilePhaseAction,
  ChangeFerriesPhase: FerryPhaseAction,
  CocFollowerPhase: ActionPhaseAction,
  CocScoringPhase: ActionPhaseAction,
  CocFinalScoringPhase: ActionPhaseAction,
  PlaceFerryPhase: FerryPhaseAction,
  PhantomPhase: ActionPhaseAction,
  TileFromSupplyPhase: TilePhaseAction,
  TunnelPhase: ActionPhaseAction,
  WagonPhase: ActionPhaseAction
}

export default {
  components: {
    ActionButton,
    ActionPhaseAction,
    BazaarPhaseAction,
    CastlePhaseAction,
    CocCountPhaseAction,
    CornCircleChoice,
    CornCircleReturn,
    CommitActionPhaseAction,
    PlacementPanel,
    DiceRollPanel,
    DragonMovePhaseAction,
    EscapePhaseAction,
    GameResultPanel,
    GoldPiecePhaseAction,
    FerryPhaseAction,
    PointsExpression,
    RemoveMageOrWitchAction,
    AwardedMeeplePanel,
    ReturnedMeeplePanel,
    ReturnedTokenPanel,
    SelectPrisonerToExchangeAction,
    ScoringPhaseAction,
    ShepherdPhaseAction,
    ShepherdPlacementConfirmPhaseAction,
    TilePhaseAction,
    TilePlacementConfirmPhaseAction,
    TowerCapturePhaseAction
  },

  props: {
    phase: { type: String, required: true },
    action: { type: Object, default: null }
  },

  data () {
    const src = require('~/assets/beep.wav')
    return {
      selected: 0,
      // the action items took a line of their own above the buttons (ActionPhaseAction)
      twoLines: false,
      // the web build's burger button sits over the bar's right end on small screens
      isWeb: isWeb(),
      BEEP_URL: src?.default ? src.default : src // hack, Nuxt doesn't convert asset to string directly (at least in dev mode)
    }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass',
      local: 'game/isActionLocal',
      ai: 'game/isActionAi',
      undoAllowed: 'game/isUndoAllowed',
      canRotatePlacedTile: 'game/canRotatePlacedTile'
    }),

    ...mapState({
      connectionState: state => state.networking.connectionStatus,
      diceRollPanel: state => state.board.diceRollPanel,
      pointsExpression: state => state.board.pointsExpression,
      awardedMeeplePanel: state => state.board.awardedMeeplePanel,
      returnedMeeplePanel: state => state.board.returnedMeeplePanel,
      returnedTokenPanel: state => state.board.returnedTokenPanel,
      placementPanel: state => state.board.placementPanel,
      beep: state => state.settings.beep,
      activePlayerIndicatorTriangle: state => state.settings.activePlayerIndicatorTriangle
    }),

    playerIndex () {
      return this.action?.player
    },

    // One source of truth for the active-player indicator, so the corner triangle and the
    // small-screen panel tint can never disagree about when to show it. The overlay panels take
    // the whole bar over, and marking a player while one of them is up would be misleading.
    showActivePlayerIndicator () {
      return !!this.action && this.activePlayerIndicatorTriangle &&
        !this.returnedMeeplePanel && !this.awardedMeeplePanel &&
        !this.returnedTokenPanel && !this.diceRollPanel && !this.placementPanel
    },

    // Tints the whole bar in the active player's colour. The rule only has an effect on small
    // screens (see player-colors.scss), where the triangle is hidden because it cramps the bar.
    //
    // The number in the class is the player's COLOUR (their slot), not their seat index — the two
    // differ as soon as anyone picks a colour out of seat order. Derived through colorCssClass the
    // same way PlayerPanel does it, so the bar and the sidebar always agree.
    activePlayerPanelColorClass () {
      if (!this.showActivePlayerIndicator) {
        return null
      }
      return this.colorCssClass(this.action.player).replaceAll('color', 'panel-color')
    },

    notifyConnectionClosed () {
      return this.connectionState === null && this.phase !== 'GameOverPhase'
    },

    actionComponent () {
      const itemType = this.action.items.length ? this.action.items[0].type : null
      if (itemType === 'Confirm') {
        return CommitActionPhaseAction
      }

      const component = MAPPING[this.phase]
      if (component) {
        return component
      }

      if (this.phase === 'CornCirclePhase') {
        if (itemType === 'CornCircleSelectDeployOrRemove') {
          return CornCircleChoice
        } else {
          return itemType === 'ReturnMeeple' ? CornCircleReturn : ActionPhaseAction
        }
      }
      if (this.phase === 'TowerCapturePhase' && itemType === 'SelectPrisonerToExchange') {
        return SelectPrisonerToExchangeAction
      }
      if (this.phase === 'MageAndWitchPhase') {
        if (itemType === 'RemoveMageOrWitch') {
          return RemoveMageOrWitchAction
        } else {
          return ActionPhaseAction
        }
      }
      return this.phase + 'Action'
    }
  },

  watch: {
    local (val) {
      if (val) {
        this.onPlayerActivated()
      } else {
        this.onPlayerDeactivated()
      }
    }
  },

  mounted () {
    window.addEventListener('keydown', this.onKeyDown)
    if (this.local) {
      this.onPlayerActivated()
    }

    this._restored = () => {
      this.clearProgress()
    }
    this._minimized = () => {
      if (this.local) {
        this.setupProgress()
      }
    }

    ipcRenderer.on('win.restore', this._restored)
    ipcRenderer.on('win.show', this._restored)
    ipcRenderer.on('win.focus', this._restored)
    ipcRenderer.on('win.minimize', this._minimized)
    ipcRenderer.on('win.hide', this._minimized)
    ipcRenderer.on('win.blur', this._minimized)

    // The bar grows to two lines with many actions. Publish its real height so what sits below it
    // follows: --action-panel-height for CSS (game.vue), board/actionPanelHeight for the history strip.
    if (typeof ResizeObserver !== 'undefined') {
      // published on the next animation frame (once per frame): moving what sits below the bar from
      // inside the observer callback would trigger "ResizeObserver loop completed with undelivered
      // notifications"
      this.heightObserver = new ResizeObserver(() => {
        if (this.heightFrame) return
        this.heightFrame = requestAnimationFrame(() => {
          this.heightFrame = null
          this.publishHeight()
        })
      })
      this.heightObserver.observe(this.$el)
    }
    this.publishHeight()
  },

  beforeDestroy () {
    window.removeEventListener('keydown', this.onKeyDown)
    ipcRenderer.off('win.restore', this._restored)
    ipcRenderer.off('win.show', this._restored)
    ipcRenderer.off('win.focus', this._restored)
    ipcRenderer.off('win.minimize', this._minimized)
    ipcRenderer.off('win.hide', this._minimized)
    ipcRenderer.off('win.blur', this._minimized)
    this.clearProgress()
    if (this.heightObserver) this.heightObserver.disconnect()
    if (this.heightFrame) cancelAnimationFrame(this.heightFrame)
    document.documentElement.style.removeProperty('--action-panel-height')
    this.$store.commit('board/actionPanelHeight', null)
  },

  methods: {
    publishHeight () {
      const h = this.$el && this.$el.offsetHeight
      if (!h) return
      document.documentElement.style.setProperty('--action-panel-height', h + 'px')
      if (this.$store.state.board.actionPanelHeight !== h) {
        this.$store.commit('board/actionPanelHeight', h)
      }
    },

    onRightClick (ev) {
      this.$root.$emit('rclick', ev)
    },

    onKeyDown (ev) {
      if (ev.key === ' ' && this.action?.canPass && !this.$store.state.gameDialog && !this.$store.state.gameChatEdit) {
        this.pass()
      }
    },

    async pass () {
      if (this.local) {
        await this.$store.dispatch('game/apply', {
          type: 'PASS',
          payload: {}
        })
      }
    },

    rotatePlacedTile () {
      this.$store.dispatch('game/rotatePlacedTile')
    },

    async undo () {
      if (this.local && this.undoAllowed) {
        await this.$store.dispatch('game/undo')
      }
    },

    async onPlayerActivated () {
      this.$store.commit('board/pointsExpression', null)
      if (this.beep) {
        this.$refs.beep.play()
      }
      const visible = await ipcRenderer.invoke('win.isVisible')
      if (!visible) {
        this.setupProgress()
      }
    },

    onPlayerDeactivated () {
      this.clearProgress()
    },

    setupProgress () {
      ipcRenderer.invoke('win.setProgressBar', [1, {
        mode: 'indeterminate'
      }])
    },

    clearProgress () {
      ipcRenderer.invoke('win.setProgressBar', [-1])
    }
  }
}
</script>

<style lang="sass">
.action-panel
  position: absolute
  top: 0
  left: 0px
  width: calc(100% - var(--aside-width-plus-gap))
  height: var(--action-bar-height)
  display: flex
  align-items: stretch
  user-select: none

  &.full-height
    height: 84px

  // many actions: the items above, the buttons below — the bar grows instead of shrinking them
  &.two-lines
    height: auto
    min-height: var(--action-bar-height)

  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')

  .text
    font-size: $action-text-size
    font-weight: 300

  > section
    flex: 1
    display: flex
    justify-content: center
    align-items: center

    .pass-item
      margin-left: 40px
      text-align: center

  .tile-img
    position: relative
    width: 84px
    height: 84px
    box-shadow: 2px 2px 5px 0px rgba(0,0,0,0.35)
    top: 7px
    transform: scale(1.1)

.active-player-marker
  position: absolute
  top: 0
  right: 0

@media (max-width: 1080px)
  .action-panel > section
    .pass-item
      margin-left: 20px

// Small screens: the bar takes the full width instead of leaving the deck counter a slot beside
// it (game.vue moves that below the bar). Same breakpoint as the active-player tint (shared.sass).
.rotate-placed
  display: none

@media (max-width: $small-screen-max-width)
  .rotate-placed
    display: block

  .action-panel
    width: 100%

    // keep clear of the web build's burger button (40px, top-right) instead of running under it
    &.web
      padding-right: 56px

    > section
      // icon-only buttons sit closer together than worded ones
      .pass-item
        margin-left: 12px

@media (max-height: 768px)
  .action-panel
    .text
      font-size: 18px

    .tile-img
      width: 72px
      height: 72px
      transform: none
</style>
