<template>
  <svg v-if="icon && icon.meeple" :class="['gei', 'meeple', { selected }]" :width="size" :height="size">
    <use :href="`${MEEPLES_SVG}#${icon.meeple}`" />
  </svg>
  <svg v-else-if="icon && icon.token" :class="['gei', 'token', { selected }]" :width="size" :height="size">
    <use :href="`${TOKENS_SVG}#${icon.token}`" />
  </svg>
  <NeutralFigure
    v-else-if="icon && icon.neutral"
    :class="['gei', { selected }]"
    :figure="icon.neutral"
    :width="icon.w || size"
    :height="size"
  />
  <StandaloneTileImage v-else-if="icon && icon.tile" class="gei" :tile-id="icon.tile" :size="size" />
  <img v-else-if="icon && icon.fig" class="gei fig" :src="figSrc(icon.fig)" :height="icon.h || size" :width="icon.w || null">
  <v-icon v-else class="gei fallback">fas fa-puzzle-piece</v-icon>
</template>

<script>
import { getElementIcon } from '@/models/elements'
import NeutralFigure from '@/components/game/NeutralFigure'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'

const MEEPLES_SVG = require('~/assets/meeples.svg')
const TOKENS_SVG = require('~/assets/tokens.svg')
// static-prefixed context require so webpack bundles assets/figures/*.png (relative path — a
// require.context directory can't use the '~' webpack alias)
const figureCtx = require.context('../../assets/figures', false, /\.png$/)

export default {
  components: {
    NeutralFigure,
    StandaloneTileImage
  },

  props: {
    // pass either a GameElement (`item`) or its id (`id`)
    item: { type: Object, default: null },
    id: { type: String, default: null },
    size: { type: Number, default: 55 },
    selected: { type: Boolean, default: false }
  },

  data () {
    return { MEEPLES_SVG, TOKENS_SVG }
  },

  computed: {
    icon () {
      return getElementIcon(this.id || (this.item && this.item.id))
    }
  },

  methods: {
    figSrc (file) {
      try {
        return figureCtx('./' + file)
      } catch (e) {
        return null
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.gei.fig
  display: block
  margin: 0 auto

.gei.fallback
  font-size: 40px

// Meeple / tunnel-token sprites are theme-tinted: disabled by default, highlighted when selected.
// (Reproduces the theming FiguresTab used to apply inline, now owned by this component.)
.meeple, .token
  +theme using ($theme)
    color: map-get($theme, 'cards-meeple-overlay')
    fill: map-get($theme, 'disabled-fill')

.meeple.selected, .token.selected
  +theme using ($theme)
    fill: map-get($theme, 'cards-selected-meeple')
    color: map-get($theme, 'cards-selected-meeple-overlay')

// Neutral figures: greyed unless selected, then their signature colour.
::v-deep .neutral
  +theme using ($theme)
    fill: map-get($theme, 'disabled-fill')

.gei.selected
  ::v-deep .fairy
    fill: $fairy-color
  ::v-deep .dragon, ::v-deep .big-top
    fill: $dragon-color
  ::v-deep .count
    fill: $count-color
  ::v-deep .mage
    fill: $mage-color
  ::v-deep .witch
    fill: $witch-color
</style>
