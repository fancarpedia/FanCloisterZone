<template>
  <!-- Small screens: one line while everything fits; with many actions the items get a line of
       their own above the buttons (two-lines) that scrolls sideways — never shrunk to fit.
       Wider screens keep the one-line bar, the items scaled by count (size-N classes). -->
  <section
    ref="section"
    :class="{ local, [`size-${items.length}`]: true, 'size-max': items.length > 14, 'two-lines': twoLines }"
  >
    <div ref="itemsRow" class="items-row">
    <div ref="itemsInner" class="items-inner">
    <div v-if="phase === 'CocFollowerPhase'" class="text-with-icons text-center">
      <v-icon>fas fa-arrow-right</v-icon>
      <v-icon>fab fa-fort-awesome-alt</v-icon>
      <br>
      {{ local ? $t('game.action.you-may-place-a-meeple-in-a-city-district') : $t('game.action.player-may-place-a-meeple-in-a-city-district') }}
    </div>
    <div v-if="phase === 'CocScoringPhase'" class="text-with-icons text-center">
      <v-icon>fab fa-fort-awesome-alt</v-icon>
      <v-icon>fas fa-arrow-right</v-icon>
      <br>
      {{ local ? $t('game.action.you-may-move-a-meeple-from-a-city-district') : $t('game.action.player-may-move-a-meeple-from-a-city-district') }}
    </div>
    <div v-if="phase === 'CocFinalScoringPhase' && rules['coc-final-scoring'] === 'market-only'" class="text-with-icons text-center">
      <v-icon>fab fa-fort-awesome-alt</v-icon>
      <v-icon>fas fa-arrow-right</v-icon>
      <br>
      {{ local ? $t('game.action.you-may-move-a-meeple-from-the-market-district-before-final-scoring') : $t('game.action.player-may-move-a-meeple-from-the-market-district-before-final-scoring') }}
    </div>
    <div v-if="phase === 'CocFinalScoringPhase' && rules['coc-final-scoring'] !== 'market-only'" class="text-with-icons text-center">
      <v-icon>fab fa-fort-awesome-alt</v-icon>
      <v-icon>fas fa-arrow-right</v-icon>
      <br>
      {{ local ? $t('game.action.you-may-move-a-meeple-from-a-city-district-before-final-scoring') : $t('game.action.player-may-move-a-meeple-from-a-city-district-before-final-scoring') }}
    </div>
    <div v-if="phase === 'CornCirclePhase'" class="text-with-icons text-center">
      <ExpansionSymbol :expansion="Expansion.CORN_CIRCLES" :style="{ width: 30, height: 30 }" /> {{ $t('game.feature.crop-circle') }}
      <br>
      {{ local ? $t('game.action.you-may-place-a-meeple-next-to-already-present-one') : $t('game.action.player-may-place-a-meeple-next-to-already-present-one') }}
    </div>

    <!-- key composed from phase meeples trigers properly mounted when one action follows another
         eg phantom action -->
    <div
      v-for="(item, idx) in items"
      :key="action.phase + item.type + (item.meeple || item.figureId || item.token)"
      :class="{'action-item': true, active: idx === selected && local }"
      @click="select(idx)"
    >
      <MeeplePlacementItem
        v-if="item.type == 'Meeple'"
        :player="action.player"
        :meeple="item.meeple"
        :options="item.options"
        :origin="item.origin"
        :phase="phase"
        :active="idx === selected && local"
        :coc="phase === 'CocScoringPhase' || phase === 'CocFinalScoringPhase'"
      />
      <MoveFairyNextToItem
        v-else-if="item.type == 'MoveFairyNextTo'"
        :figure-id="item.figureId"
        :options="item.options"
        :active="idx === selected && local"
      />
      <MoveFairyOnTileItem
        v-else-if="item.type == 'MoveFairyOnTile'"
        :figure-id="item.figureId"
        :options="item.options"
        :active="idx === selected && local"
      />
      <NeutralFigureItem
        v-else-if="item.type == 'NeutralFigure'"
        :figure-id="item.figureId"
        :options="item.options"
        :active="idx === selected && local"
      />
      <ReturnMeepleItem
        v-else-if="item.type == 'ReturnMeeple'"
        :player="action.player"
        :source="item.source"
        :options="item.options"
        :active="idx === selected && local"
      />
      <TowerPieceItem
        v-else-if="item.type == 'TowerPiece'"
        :options="item.options"
        :token="item.token"
        :active="idx === selected && local"
      />
      <BridgeItem
        v-else-if="item.type == 'Bridge'"
        :options="item.options"
        :active="idx === selected && local"
      />
      <TunnelItem
        v-else-if="item.type == 'Tunnel'"
        :player="action.player"
        :token="item.token"
        :options="item.options"
        :active="idx === selected && local"
      />
      <LittleBuildingItem
        v-else-if="item.type == 'LittleBuilding'"
        :token="item.token"
        :position="item.position"
        :active="idx === selected && local"
      />
      <ScoreAcrobatsItem
        v-else-if="item.type == 'ScoreAcrobats'"
        :player="action.player"
        :options="item.options"
        :active="idx === selected && local"
      />
      <MoveDonkeyOnTileItem
        v-else-if="item.type == 'MoveDonkeyOnTile'"
        :figure-id="item.figureId"
        :options="item.options"
        :active="idx === selected && local"
      />
      <div v-else>{{ item.type }}</div>
    </div>
    </div>
    </div>
    <div ref="buttonsRow" class="buttons-row">
      <slot />
    </div>
  </section>
</template>

<script>
import { mapState } from 'vuex'

import { isSmallScreen } from '@/utils/small-screen'

import { Expansion } from '@/models/expansions'
import ExpansionSymbol from '@/components/ExpansionSymbol'
import BridgeItem from '@/components/game/actions/items/BridgeItem.vue'
import LittleBuildingItem from '@/components/game/actions/items/LittleBuildingItem.vue'
import MeeplePlacementItem from '@/components/game/actions/items/MeeplePlacementItem.vue'
import MoveDonkeyOnTileItem from '@/components/game/actions/items/MoveDonkeyOnTileItem.vue'
import MoveFairyNextToItem from '@/components/game/actions/items/MoveFairyNextToItem.vue'
import MoveFairyOnTileItem from '@/components/game/actions/items/MoveFairyOnTileItem.vue'
import NeutralFigureItem from '@/components/game/actions/items/NeutralFigureItem.vue'
import ReturnMeepleItem from '@/components/game/actions/items/ReturnMeepleItem.vue'
import ScoreAcrobatsItem from '@/components/game/actions/items/ScoreAcrobatsItem.vue'
import TowerPieceItem from '@/components/game/actions/items/TowerPieceItem.vue'
import TunnelItem from '@/components/game/actions/items/TunnelItem.vue'

export default {
  components: {
    BridgeItem,
    ExpansionSymbol,
    LittleBuildingItem,
    MeeplePlacementItem,
    MoveDonkeyOnTileItem,
    MoveFairyNextToItem,
    MoveFairyOnTileItem,
    NeutralFigureItem,
    ReturnMeepleItem,
    ScoreAcrobatsItem,
    TowerPieceItem,
    TunnelItem
  },

  props: {
    action: { type: Object, required: true },
    phase: { type: String, required: true },
    local: { type: Boolean }
  },

  data () {
    return {
      Expansion,
      selected: null,
      // items on a line of their own above the buttons (see measureLines)
      twoLines: false
    }
  },

  computed: {
    small () {
      return isSmallScreen()
    },

    ...mapState({
      rules: state => state.game.setup.rules
    }),

    // Default focused item. Bridge is moved to the front for visibility (see items()), but the focus
    // should land on the NEXT option (the actual meeple/placement) when one exists — not the bridge.
    // Non-bridge actions keep focusing the first item as before. Observers (non-local) focus nothing.
    defaultSelected () {
      if (!this.local) return null
      return (this.items.length > 1 && this.items[0].type === 'Bridge') ? 1 : 0
    },

    items () {
      const items = []
      this.action.items.forEach(item => {
        if (item.type === 'LittleBuilding') {
          // use includes three times instead of forEach over options to get items sorted by building type
          if (item.options.includes('LB_SHED')) items.push({ ...item, token: 'LB_SHED' })
          if (item.options.includes('LB_HOUSE')) items.push({ ...item, token: 'LB_HOUSE' })
          if (item.options.includes('LB_TOWER')) items.push({ ...item, token: 'LB_TOWER' })
        } else {
          items.push(item)
        }
      })
      // In the action panel, bridge placement is shown BEFORE any meeples (a stable move to the
      // front; everything else keeps the engine's order). This differs from the player supply
      // (PlayerPanel), where the bridge intentionally stays after the meeples.
      const bridges = items.filter(i => i.type === 'Bridge')
      if (bridges.length) {
        return [...bridges, ...items.filter(i => i.type !== 'Bridge')]
      }
      return items
    }
  },

  watch: {
    // crossing the small-screen breakpoint re-decides the layout
    small () {
      this.scheduleMeasure()
    },

    action: {
      immediate: true,
      handler () {
        this.selected = this.defaultSelected
      }
    }
  },

  mounted () {
    this.$root.$on('rclick', this.selectNext)
    // re-decide one line vs two whenever the bar, the items or the buttons change size
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure())
      for (const el of [this.$refs.section, this.$refs.itemsInner, this.$refs.buttonsRow]) {
        if (el) this.resizeObserver.observe(el)
      }
    }
    this.scheduleMeasure()
  },

  updated () {
    this.scheduleMeasure()
  },

  beforeDestroy () {
    this.$root.$off('rclick', this.selectNext)
    if (this.resizeObserver) this.resizeObserver.disconnect()
    if (this.measureFrame) cancelAnimationFrame(this.measureFrame)
    if (this.twoLines) this.$emit('two-lines', false)
  },

  methods: {
    // Two lines when the items and the buttons together are wider than the bar. Measured from the
    // content's own widths (the items' inner strip never shrinks), so the decision is the same
    // whichever layout is showing — no flip-flopping. Without buttons the items stay on the one
    // line and simply scroll.
    // Measure on the next animation frame, once per frame however many notifications arrive.
    // Switching the layout from inside a ResizeObserver callback resizes the very elements it
    // watches in the same frame, which the browser reports as "ResizeObserver loop completed with
    // undelivered notifications".
    scheduleMeasure () {
      if (this.measureFrame) return
      this.measureFrame = requestAnimationFrame(() => {
        this.measureFrame = null
        this.measureLines()
      })
    },

    measureLines () {
      const { section, itemsInner, buttonsRow } = this.$refs
      if (!section || !itemsInner || !buttonsRow) return
      if (!isSmallScreen()) {
        // wider screens keep the one-line bar (items scaled by count)
        if (this.twoLines) {
          this.twoLines = false
          this.$emit('two-lines', false)
        }
        return
      }
      const style = getComputedStyle(section)
      const available = section.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0)
      const buttons = buttonsRow.scrollWidth
      const twoLines = buttons > 0 && itemsInner.scrollWidth + buttons + 8 > available
      if (twoLines !== this.twoLines) {
        this.twoLines = twoLines
        this.$emit('two-lines', twoLines)
      }
    },

    select (idx) {
      if (this.local) {
        this.selected = idx
      } else {
        this.selected = null
      }
    },

    selectNext () {
      if (this.local) {
        this.select((this.selected + 1) % this.items.length)
      }
    }
  }
}
</script>

<style lang="sass" scoped>
section
  overflow: hidden

  .text
    font-size: 20px
    font-weight: 300
    margin-right: 20px

  .text-with-icons
    font-size: 18px
    font-weight: 300
    margin-right: 20px

    i
      font-size: 30px
      margin-bottom: 4px

  .action-item
    --action-item-scale: 1.0
    --action-item-margin: -5px
    width: calc(120px * var(--action-item-scale))
    height: calc(var(--action-bar-height) + 10px)
    transform: scale(var(--action-item-scale))
    margin: var(--action-item-margin)
    display: flex
    justify-content: center
    align-items: center

    &.active
      cursor: default

      +theme using ($theme)
        background: rgba(map-get($theme, 'action-panel-active-bg'), 0.72)
        border-radius: 500px

section.local
  .action-item
    cursor: pointer

    &:hover
      +theme using ($theme)
        background: rgba(map-get($theme, 'action-panel-hover-bg'), 0.72)
        border-radius: 500px

// Small screens (≤ 960px) never shrink the items: with many actions they get a line of their own
// above the buttons (section.two-lines, decided in measureLines) and that line scrolls sideways.
// Wider screens keep the one-line bar, scaled down by item count (the rules after this block).
.items-row
  display: flex
  min-width: 0
  overflow: hidden

// auto margins centre the strip while it fits and fall to 0 once it overflows, so a scrolling row
// still starts at its first item (justify-content: center would cut the left end off)
.items-inner
  display: flex
  align-items: center
  flex: none
  margin: 0 auto

.buttons-row
  display: flex
  align-items: center
  flex: none

@media (max-width: 960px)
  section
    min-width: 0

  .items-row
    overflow-x: auto
    scrollbar-width: thin

  section.two-lines
    flex-direction: column
    align-items: stretch

    .items-row
      width: 100%

    .buttons-row
      justify-content: center
      padding: 2px 0 6px

      // the first button starts the line: no gap in front of it
      ::v-deep > :first-child
        margin-left: 0

  // Each item is a round slot exactly the bar's height, so the highlight of the selected / hovered
  // item is a circle that fits the bar (as on larger screens); the meeple / token inside is drawn
  // at 80% so it sits within that circle with a margin. Fixed, never by item count.
  section .action-item
    --action-item-scale: 1
    width: var(--action-bar-height)
    height: var(--action-bar-height)
    margin: 0 2px
    transform: none

    > *
      transform: scale(0.8)

// --- wider screens: one line, items scaled by count ---------------------------------------------
@media (max-height: 800px) and (min-width: 961px)
  section
    .action-item
      --action-item-scale: 0.6
      --action-item-margin: -12px

@media (min-width: 961px) and (min-height: 769px)
section.size-max
    .action-item
      --action-item-scale: 0.85
      --action-item-margin: -8px

@media (min-width: 961px) and (max-width: 1920px) and (min-height: 769px)
  section.size-max
    .action-item
      --action-item-scale: 0.65
      --action-item-margin: -11px
  section.size-14, section.size-13
    .action-item
      --action-item-scale: 0.75
      --action-item-margin: -10px
  section.size-12, section.size-11
    .action-item
      --action-item-scale: 0.85
      --action-item-margin: -8px

@media (min-width: 961px) and (max-width: 1700px) and (min-height: 769px)
  section.size-max
    .action-item
      --action-item-scale: 0.6
      --action-item-margin: -12px
  section.size-12, section.size-11
    .action-item
      --action-item-scale: 0.75
      --action-item-margin: -10px
  section.size-10, section.size-9
    .action-item
      --action-item-scale: 0.85
      --action-item-margin: -8px

@media (min-width: 961px) and (max-width: 1550px) and (min-height: 769px)
  section.size-max, section.size-14, section.size-13, section.size-12, section.size-11
    .action-item
      --action-item-scale: 0.65
      --action-item-margin: -11px
  section.size-10, section.size-9
    .action-item
      --action-item-scale: 0.6
      --action-item-margin: -12px

@media (min-width: 961px) and (max-width: 1410px)
  section.size-max, section.size-14, section.size-13, section.size-12, section.size-11
    .action-item
      --action-item-scale: 0.55
      --action-item-margin: -12px
@media (min-width: 961px) and (max-width: 1410px) and (min-height: 769px)
   section.size-8, section.size-7
    .action-item
      --action-item-scale: 0.85
      --action-item-margin: -8px

@media (min-width: 961px) and (max-width: 1280px)
  section.size-max, section.size-14, section.size-13, section.size-12, section.size-11
    .action-item
      --action-item-scale: 0.5
      --action-item-margin: -12px
@media (min-width: 961px) and (max-width: 1280px) and (min-height: 769px)
   section.size-8, section.size-7
    .action-item
      --action-item-scale: 0.75
      --action-item-margin: -10px

@media (min-width: 961px) and (max-width: 1060px)
  section.size-max, section.size-14, section.size-13, section.size-12, section.size-11
    .action-item
      --action-item-scale: 0.4
      --action-item-margin: -12px
  section.size-10, section.size-9
    .action-item
      --action-item-scale: 0.5
      --action-item-margin: -12px
@media (min-width: 961px) and (max-width: 1060px) and (min-height: 769px)
  section.size-8, section.size-7
    .action-item
      --action-item-scale: 0.65
      --action-item-margin: -11px
  section.size-6, section.size-5
    .action-item
      --action-item-scale: 0.85
      --action-item-margin: -8px
</style>
