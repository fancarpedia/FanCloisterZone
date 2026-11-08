<template>
  <g id="bridge-layer">
    <g
      v-for="bridge in bridges"
      :key="positionAsKey(bridge.position)"
      :transform="transformPosition(bridge.position)"
    >
      <path
        d="M 0 540 L 0 360 L 900 360 L 900 540 L 765 540 C 765 392 135 392 135 540 Z"
        :fill="fillColor(bridge)"
        fill-opacity="0.75"
        :stroke="strokeColor(bridge)"
        stroke-width="15"
        :transform="bridge.location ===  'NS' ? 'rotate(90 450 450)' : ''"
      />
    </g>
  </g>
</template>

<script>
import { mapState } from 'vuex'
import LayerMixin from '@/components/game/layers/LayerMixin'

export default {
  mixins: [LayerMixin],

  computed: mapState({
    emphasis: state => state.board.layers.EmphasizeLayer?.emphasis,
    theme: state => state.settings.theme
  }),

  methods: {
    // The bridge's own colour, and nothing else's business. Highlighting must not touch it:
    // different kinds of bridge are coming, each with its own colour, and repainting the fill
    // would throw that away exactly when the player is looking at it. A kind-specific colour
    // plugs in here.
    fillColor (bridge) {
      return bridge.color || 'brown'
    },

    // How the highlight reads instead. A dimmed dark board swallowed a brown bridge, which is
    // why the fill used to be forced to white; outlining it keeps it legible without losing the
    // colour underneath.
    strokeColor (bridge) {
      return this.theme === 'dark' && this.isEmphasized(bridge) ? 'white' : 'black'
    },

    isEmphasized (bridge) {
      if (this.emphasis?.type !== 'feature') {
        return false
      }
      return !!this.emphasis.places.find(({ location, tile }) =>
        bridge.location === location &&
        bridge.position[0] === tile.position[0] &&
        bridge.position[1] === tile.position[1]
      )
    }
  }
}
</script>

<style lang="sass" scoped>
</style>
