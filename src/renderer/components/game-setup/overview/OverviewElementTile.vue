<template>
  <OverviewTile
    :enabled="enabled"
    :z-index="zIndex"
  >
    <!-- Which image an element uses comes from ELEMENT_ICONS (models/elements.js) so it cannot
         drift from the setup boxes; only the SIZE is local, because the overview draws bigger
         than the 55px setup tiles. -->
    <svg v-if="icon && icon.meeple" class="meeple" :width="70" :height="70">
      <use :href="`${MEEPLES_SVG}#${icon.meeple}`" />
    </svg>
    <svg v-else-if="icon && icon.token" class="meeple" :width="70" :height="70">
      <use :href="`${TOKENS_SVG}#${icon.token}`" />
    </svg>
    <NeutralFigure
      v-else-if="icon && icon.neutral"
      :figure="icon.neutral"
      :width="size.w"
      :height="size.h"
    />
    <StandaloneTileImage v-else-if="icon && icon.tile" :tile-id="icon.tile" :size="70" />
    <img v-else-if="icon && icon.fig" :src="figSrc(icon.fig)" :width="size.w" :height="size.h">
    <img v-else-if="icon && icon.feature" :src="featureSrc(icon.feature)" :width="size.w" :height="size.h">

    <!-- Bespoke renderings — not a plain image lookup, so they stay here. -->
    <svg v-else-if="element === 'farmers'" class="meeple" :width="70" :height="70">
      <g transform="translate(42 32) scale(0.6) rotate(90) translate(-27 -27)">
        <use :href="`${MEEPLES_SVG}#small-follower`" />
      </g>
    </svg>
    <TokenImage v-else-if="element === 'flowers'" token="FLOWERS_YELLOW" :height="55" />
    <div v-else-if="element === 'pre-draw'" class="predraw-icon">⤵<span>hand</span></div>
    <div v-else-if="element === 'keep-building'" class="predraw-icon">🤝<span>co-op</span></div>

    <template #quantity>
      <div class="quantity" :class="enabled ? 'addition': 'removal'">
        {{ label }}
      </div>
    </template>

    <template #title>
      <template v-if="element === 'traders'">{{ $t('game.feature.trade-goods') }}</template>
      <template v-else>{{ elementTitle }}</template>
    </template>
  </OverviewTile>
</template>

<script>
import { getElementIcon } from '@/models/elements'
import NeutralFigure from '@/components/game/NeutralFigure'
import OverviewTile from '@/components/game-setup/overview/OverviewTile'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import TokenImage from '@/components/game/TokenImage'

const MEEPLES_SVG = require('~/assets/meeples.svg')
const TOKENS_SVG = require('~/assets/tokens.svg')
// context requires so webpack bundles the referenced assets (a require.context directory
// cannot use the '~' alias, hence the relative paths). `true` = recurse into C1/C2.
const figureCtx = require.context('../../../assets/figures', false, /\.png$/)
const featureCtx = require.context('../../../assets/features', true, /\.(png|jpg)$/)

// Overview-only sizing, where this tile draws an icon differently from the setup boxes.
// Anything not listed falls back to the ELEMENT_ICONS w/h hint (or 70×70 for neutral figures).
const NEUTRAL_SIZE = { w: 70, h: 70 }
const OVERVIEW_SIZE = {
  'tower': { h: 45 },
  'black-tower': { h: 45 },
  'bridge': { h: 45 },
  'castle': { w: 66, h: 55 },
  'little-buildings': { w: 70, h: 70 },
  'king': { w: 70, h: 70 },
  'robber': { w: 70, h: 70 },
  'traders': { h: 28 },
  'gold': { w: 70, h: 37 },
  'dragon': { w: 80, h: 40 }
}

export default {
  components: {
    NeutralFigure,
    OverviewTile,
    StandaloneTileImage,
    TokenImage
  },

  props: {
    element: { type: String, required: true },
    value: { type: [String, Number, Boolean], required: true },
    zIndex: { type: Number, default: 1 }
  },

  data () {
    return { MEEPLES_SVG, TOKENS_SVG }
  },

  computed: {
    icon () {
      return getElementIcon(this.element)
    },

    size () {
      const { icon } = this
      if (!icon) return {}
      const override = OVERVIEW_SIZE[this.element]
      if (override) return override
      if (icon.neutral) return NEUTRAL_SIZE
      return { w: icon.w || null, h: icon.h || null }
    },

    enabled () {
      return this.value === true || this.value > 0
    },

    label () {
      if (this.value === true || this.value === 1) return '+'
      if (this.value === false) return '-'
      if (this.value > 0) return '+' + this.value
      return '' + this.value
    },

    elementTitle () {
      if (this.$te('game.feature.' + this.element)) {
        return this.$t('game.feature.' + this.element)
      }
      if (this.$te('game.element.' + this.element)) {
        return this.$t('game.element.' + this.element)
      }
      return this.element.replace('-', ' ')
    }
  },

  methods: {
    figSrc (file) {
      try {
        return figureCtx('./' + file)
      } catch (e) {
        return null
      }
    },

    featureSrc (file) {
      try {
        return featureCtx('./' + file)
      } catch (e) {
        return null
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.predraw-icon
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  width: 70px
  height: 70px
  font-size: 28px

  span
    font-size: 11px

.tile-img, img
  filter: grayscale(100%)

.off
  .tile-img, img
    filter: grayscale(75%)

.fishermen
  position: relative
  height: 55px

  svg
    top: 0
    left: calc(50% - 27px)
    position: absolute

#app.theme--dark .icon img.bw
  .tile-img, img
    filter: grayscale(100%)

  .off
    .tile-img, img
      filter: grayscale(25%)
</style>
