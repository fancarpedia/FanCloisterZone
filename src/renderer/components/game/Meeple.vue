<template>
  <svg class="meeple">
    <use :href="`${MEEPLES_SVG}#${svgMeepleId}`" />
    <!-- an AI player: a robot head drawn INSIDE the meeple's svg, positioned and sized in % of
         the meeple, so it is centred on the head and scales with it at every meeple size (lobby,
         slot selection, final scoring, victory panel — one look across the app) -->
    <svg
      v-if="ai"
      class="ai-head"
      x="27.5%"
      y="-8.5%"
      width="45%"
      height="36%"
      viewBox="-40 -40 720 592"
    >
      <path :d="ROBOT_PATH" />
    </svg>
  </svg>
</template>

<script>
import kebabCase from 'lodash/kebabCase'

const MEEPLES_SVG = require('~/assets/meeples.svg')

// Font Awesome Free 6.3.0 "robot" (solid), CC BY 4.0 — the same glyph as `fa-solid fa-robot`
const ROBOT_PATH = 'M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z'

export default {
  props: {
    type: { type: String, required: true },
    // draw a robot head on the meeple (an AI player / seat)
    ai: { type: Boolean, default: false }
  },

  data () {
    return { MEEPLES_SVG, ROBOT_PATH }
  },

  computed: {
    svgMeepleId () {
      return kebabCase(this.type)
    }
  }
}
</script>

<style lang="sass" scoped>
// the robot head reaches a little above the meeple's box — don't clip it
.meeple
  overflow: visible

// white robot with a dark outline (stroke painted under the fill), readable on every player colour
.ai-head
  overflow: visible
  pointer-events: none

  path
    fill: white
    stroke: rgba(0, 0, 0, 0.85)
    stroke-width: 56px
    stroke-linejoin: round
    paint-order: stroke
</style>
