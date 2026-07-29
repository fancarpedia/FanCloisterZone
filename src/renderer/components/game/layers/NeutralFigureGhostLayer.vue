<template>
  <g id="neutral-figure-ghost-layer" :transform="ghostTransform">
    <use
      class="neutral-ghost"
      :class="figure"
      :x="-BASE_SIZE * 0.21"
      :y="-BASE_SIZE * 0.21"
      :width="BASE_SIZE * 0.42"
      :height="BASE_SIZE * 0.42"
      :href="`${NEUTRAL_SVG}#${figure}`"
    />
  </g>
</template>

<script>
// Temporary layer shown while hovering a score event tied to a neutral figure (fairy, black-fairy,
// …), to pulse that figure at the exact spot it scored from — used when the figure is no longer
// deployed there (removed), so the player can see where it was. Position is the event's feature
// pointer; `figure` is any id present in neutral.svg.
import LayerMixin from '@/components/game/layers/LayerMixin'
import { BASE_SIZE } from '@/constants/ui'

const NEUTRAL_SVG = require('~/assets/neutral.svg')

export default {
  mixins: [LayerMixin],

  props: {
    // any neutral figure id in neutral.svg, e.g. 'fairy' | 'black-fairy'
    figure: { type: String, required: true },
    // where the figure was: a feature pointer { position, feature, location } (placed next to a
    // meeple) OR a bare tile position [x, y] / { position } (the on-tile placement rule)
    ptr: { type: [Object, Array], required: true }
  },

  data () {
    return { NEUTRAL_SVG, BASE_SIZE }
  },

  computed: {
    ghostTransform () {
      const p = this.ptr
      const pos = Array.isArray(p) ? p : (p.position || null)
      const hasFeature = !Array.isArray(p) && p.feature && p.location
      if (hasFeature) {
        // next-to a follower → the feature point
        return this.transformPoint(p)
      }
      if (pos) {
        // on-tile → centre the figure on the tile
        return this.transformPosition(pos) + ` translate(${BASE_SIZE / 2} ${BASE_SIZE / 2})`
      }
      return ''
    }
  }
}
</script>

<style lang="sass" scoped>
.neutral-ghost
  animation: neutral-ghost-pulse 1s ease-in-out infinite

// the plain fairy symbol has no baked fill — give the ghost a visible one; figures that carry their
// own fill in the sprite (e.g. black-fairy) are left untouched
.neutral-ghost.fairy
  fill: $fairy-color
  stroke: black
  stroke-width: 8

@keyframes neutral-ghost-pulse
  0%
    opacity: 0.3
  50%
    opacity: 1
  100%
    opacity: 0.3
</style>
