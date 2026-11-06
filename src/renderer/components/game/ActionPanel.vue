<template>
  <div
    :class="['action-panel', { 'full-height': pointsExpression || phase === 'GameOverPhase' }, activePlayerPanelColorClass]"
    @click.right="onRightClick"
  >
    <div v-if="notifyConnectionClosed" class="flex-grow-1">
      <v-alert type="error">
        Host terminated the game. Connection was closed.
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
    <!-- use v-show bit v-if for pointsExoression - to not hide related layers when pointExpression is triggered by mouse hover  -->
    <component
      :is="actionComponent"
      v-if="action"
      v-show="!pointsExpression && !notifyConnectionClosed && !returnedMeeplePanel && !awardedMeeplePanel && !returnedTokenPanel && !diceRollPanel"
      :action="action"
      :phase="phase"
      :local="local && !ai"
    >
      <template
        v-if="action.canPass || undoAllowed"
        #default="{ plain, label }"
      >
        <template v-if="local && !ai">
          <template v-if="action.canPass">
            <span v-if="plain !== ''" class="skip-text text">{{ $t('game.action.or') }}</span>
            <div class="pass-item">
              <v-btn :large="$vuetify.breakpoint.height > 768" color="secondary" @click="pass">{{ label || $t('game.action.skip-action') }}</v-btn>
            </div>
          </template>
          <!-- undo (e.g. take back the tile placement / a wrong meeple choice); on mobile/web this
               is the only way to undo — there is no keyboard shortcut or native menu -->
          <template v-if="undoAllowed">
            <span class="skip-text text">{{ $t('game.action.or') }}</span>
            <div class="pass-item">
              <v-btn :large="$vuetify.breakpoint.height > 768" @click="undo">{{ $t('button.undo') }}</v-btn>
            </div>
          </template>
        </template>
        <template v-else-if="action.canPass">
          <span class="skip-text text">{{ $t('game.action.or') }} {{ $t('game.action.skip-action') }}</span>
        </template>
      </template>
    </component>

    <GameResultPanel
      v-else-if="phase === 'GameOverPhase'"
      v-show="!pointsExpression && !returnedMeeplePanel && !awardedMeeplePanel && !returnedTokenPanel && !diceRollPanel"
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

import ActionPhaseAction from '@/components/game/actions/ActionPhaseAction.vue'
import BazaarPhaseAction from '@/components/game/actions/BazaarPhaseAction.vue'
import CastlePhaseAction from '@/components/game/actions/CastlePhaseAction.vue'
import CocCountPhaseAction from '@/components/game/actions/CocCountPhaseAction.vue'
import CornCircleChoice from '@/components/game/actions/CornCircleChoice.vue'
import CornCircleReturn from '@/components/game/actions/CornCircleReturn.vue'
import CommitActionPhaseAction from '@/components/game/actions/CommitActionPhaseAction.vue'
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
import ShepherdPhaseAction from '@/components/game/actions/ShepherdPhaseAction.vue'
import ShepherdPlacementConfirmPhaseAction from '@/components/game/actions/ShepherdPlacementConfirmPhaseAction.vue'
import TilePhaseAction from '@/components/game/actions/TilePhaseAction.vue'
import TilePlacementConfirmPhaseAction from '@/components/game/actions/TilePlacementConfirmPhaseAction.vue'
import TowerCapturePhaseAction from '@/components/game/actions/TowerCapturePhaseAction.vue'

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
    ActionPhaseAction,
    BazaarPhaseAction,
    CastlePhaseAction,
    CocCountPhaseAction,
    CornCircleChoice,
    CornCircleReturn,
    CommitActionPhaseAction,
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
      BEEP_URL: src?.default ? src.default : src // hack, Nuxt doesn't convert asset to string directly (at least in dev mode)
    }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass',
      local: 'game/isActionLocal',
      ai: 'game/isActionAi',
      undoAllowed: 'game/isUndoAllowed'
    }),

    ...mapState({
      connectionState: state => state.networking.connectionStatus,
      diceRollPanel: state => state.board.diceRollPanel,
      pointsExpression: state => state.board.pointsExpression,
      awardedMeeplePanel: state => state.board.awardedMeeplePanel,
      returnedMeeplePanel: state => state.board.returnedMeeplePanel,
      returnedTokenPanel: state => state.board.returnedTokenPanel,
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
        !this.returnedTokenPanel && !this.diceRollPanel
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
  },

  methods: {
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

  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')

  .text
    font-size: 20px
    font-weight: 300

  > section
    flex: 1
    display: flex
    justify-content: center
    align-items: center

    .skip-text
      margin-left: 40px

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
    .skip-text
      margin-left: 20px

    .pass-item
      margin-left: 20px

// Small screens: drop the "or / or skip action" hint. It is secondary to the button next to it,
// and the bar has no room for it here. Same breakpoint as the active-player tint (shared.sass).
@media (max-width: $small-screen-max-width)
  .action-panel > section
    span.skip-text
      display: none

@media (max-height: 768px)
  .action-panel
    .text
      font-size: 18px

    .tile-img
      width: 72px
      height: 72px
      transform: none
</style>
