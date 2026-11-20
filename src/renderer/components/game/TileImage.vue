<template>
  <g :data-tile-id="tileId">
    <component
      :is="layer.tag"
      v-for="(layer, idx) in layers"
      :key="idx"
      v-bind="layer.props"
    />
  </g>
</template>

<script>
export default {
  props: {
    tileId: { type: String, required: true },
    rotation: { type: Number, default: 0 }
  },

  computed: {
    layers () {
      // re-computed once the artworks have loaded — a tile rendered before (e.g. a supply tile or
      // an element icon during start-up) would otherwise keep the "missing image" placeholder
      void this.$store.state.loaded.artworks // eslint-disable-line no-void
      return this.$theme.getTileLayers(this.tileId, this.rotation).layers
    }
  }
}
</script>
