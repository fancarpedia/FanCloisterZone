<template>
  <!-- the wrapper carries the tooltip: a token can render as an svg, which shows no title -->
  <div
    class="token-placed"
    :title="causeTitle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <TokenImage
      :class="cssClass"
      :token="ev.token"
      :player="player"
      :height="height"
    />
  </div>
</template>

<script>
import TokenImage from '@/components/game/TokenImage'
import { causeTitle, withCause } from '@/utils/placement-cause'

const FULL_SIZE_TOKENS = new Set(['WOLF', 'SHEEP', 'TUNNEL', 'FERRY', 'LB'])

export default {
  components: {
    TokenImage
  },

  props: {
    ev: { type: Object, required: true },
    player: { type: Number, default: null }
  },

  computed: {
    // what triggered this when no player chose it (engine PlacementCause), as a tooltip
    causeTitle () {
      return causeTitle(this.ev.cause, this) || null
    },

    height () {
      if (this.ev.token === 'GOLD') {
        return 21
      }
      const baseName = this.ev.token.split('_')[0]
      return FULL_SIZE_TOKENS.has(baseName) ? 40 : 26
    },

    cssClass () {
      if (this.ev.token === 'FERRY') {
        const { location } = this.ev.to
        return `token-FERRY location-${location}`
      }
      return ''
    }
  },

  methods: {
    onMouseEnter () {
      // The action panel tells what was placed: by the game itself with its cause (mandatory
      // bridge, gold, sheep, …), or by the player of their own will (tower piece, bridge, little
      // building, tunnel, …) — "Placed by <player>", the turn's player (ev has none of its own).
      const panel = { kind: 'placed', token: this.ev.token, to: this.ev.to }
      if (this.ev.cause) {
        panel.cause = this.ev.cause
      } else {
        Object.assign(panel, { player: this.player, byPlayer: true, byKey: 'game.placement.placed-by' })
      }
      this.$store.commit('board/placementPanel', panel)
      let emphasis
      if (this.ev.token === 'BRIDGE' || this.ev.token === 'FERRY') {
        emphasis = {
          type: 'tile',
          position: this.ev.to.position
        }
      } else if (Array.isArray(this.ev.to)) {
        emphasis = {
          type: 'tile',
          position: this.ev.to
        }
      } else {
        emphasis = {
          type: 'meeple',
          ...this.ev.to
        }
      }
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: withCause(emphasis, this.ev.cause)
        }
      })
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.token-placed
  display: flex
  align-items: center
  justify-content: center

.token-image:not(.tunnel):not(.token-BRIDGE)
  +theme using ($theme)
    fill: map-get($theme, 'text-color')

.token-FERRY
  background-image: url('~assets/icons/water.jpg')
</style>

<style lang="sass">
.token-FERRY
  &.location-NS svg
    transform: rotate(90deg)

  &.location-NW svg
    transform: translate(-4px, -4px) rotate(-45deg)

  &.location-SW svg
    transform: translate(-4px, 4px) rotate(45deg)

  &.location-NE svg
    transform: translate(4px, -4px) rotate(45deg)

  &.location-SE svg
    transform: translate(4px, 4px) rotate(-45deg)
</style>
