<template>
  <g id="neutral-figure-ghost-layer">
    <g v-for="(g, idx) in drawn" :key="idx" :transform="g.transform" :class="{ origin: g.role === 'from' }">
      <!-- where a figure came FROM is drawn as a faded, still ghost in a dashed ring, so it is not
           mistaken for where it went (the bright, pulsing one) -->
      <circle
        v-if="g.role === 'from'"
        class="origin-ring"
        cx="0"
        cy="0"
        :r="BASE_SIZE * g.size * 0.7"
        fill="none"
        :stroke-width="BASE_SIZE * 0.025"
        :stroke-dasharray="BASE_SIZE * 0.05 + ' ' + BASE_SIZE * 0.04"
      />
      <use
        class="neutral-ghost"
        :class="g.figure"
        :x="-BASE_SIZE * g.size / 2"
        :y="-BASE_SIZE * g.size / 2"
        :width="BASE_SIZE * g.size"
        :height="BASE_SIZE * g.size"
        :href="`${NEUTRAL_SVG}#${g.figure}`"
      />
    </g>
  </g>
</template>

<script>
// Temporary layer shown while hovering a score event tied to a neutral figure (fairy, black-fairy,
// courier, …), to pulse that figure at the exact spot it scored from — used when the figure is no
// longer deployed there (removed), so the player can see where it was. Position is the event's
// feature pointer; `figure` is any id present in neutral.svg. Several ghosts can be drawn at once
// (`ghosts`), e.g. the courier where it came from and where it went.
import LayerMixin from '@/components/game/layers/LayerMixin'
import { BASE_SIZE } from '@/constants/ui'

const NEUTRAL_SVG = require('~/assets/neutral.svg')

export default {
  mixins: [LayerMixin],

  props: {
    // any neutral figure id in neutral.svg, e.g. 'fairy' | 'black-fairy' | 'courier'
    figure: { type: String, default: null },
    // where the figure was: a feature pointer { position, feature, location } (placed next to a
    // meeple) OR a bare tile position [x, y] / { position } (the on-tile placement rule)
    ptr: { type: [Object, Array], default: null },
    // several ghosts at once: [{ figure, ptr, nextToMeeple }] — nextToMeeple shifts the figure off
    // the meeple's spot, the way the board draws a neutral figure standing beside a follower
    ghosts: { type: Array, default: null }
  },

  data () {
    return { NEUTRAL_SVG, BASE_SIZE }
  },

  computed: {
    drawn () {
      const list = this.ghosts || (this.figure && this.ptr ? [{ figure: this.figure, ptr: this.ptr }] : [])
      return list.map(({ figure, ptr, nextToMeeple, role }) => {
        // the courier is drawn smaller than the other neutral figures on the board (MeepleLayer)
        const size = figure === 'courier' ? 0.32 : 0.42
        let transform = this.ghostTransform(ptr)
        if (transform && nextToMeeple) {
          transform += ` translate(${BASE_SIZE * 0.18} ${BASE_SIZE * 0.02})`
        }
        // upright on a turned board, like the figures themselves
        if (transform) transform += ' ' + this.upright()
        return { figure, size, transform, role: role || null }
      }).filter(g => g.transform)
    }
  },

  methods: {
    ghostTransform (p) {
      if (!p) return ''
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

// the spot a figure came from: a grey ghost pulsing faintly (dimmer than the new spot's bright
// pulse) inside a slowly turning dashed ring
.origin
  .neutral-ghost
    animation: origin-ghost-pulse 1.6s ease-in-out infinite
    filter: grayscale(1)

  .origin-ring
    stroke: rgba(80, 80, 80, 0.85)
    // turn around its own centre (the circle sits at 0,0 of the ghost's group)
    transform-box: fill-box
    transform-origin: center
    animation: origin-ring-spin 6s linear infinite

@keyframes origin-ghost-pulse
  0%
    opacity: 0.2
  50%
    opacity: 0.6
  100%
    opacity: 0.2

@keyframes origin-ring-spin
  from
    transform: rotate(0deg)
  to
    transform: rotate(360deg)

@keyframes neutral-ghost-pulse
  0%
    opacity: 0.3
  50%
    opacity: 1
  100%
    opacity: 0.3
</style>
