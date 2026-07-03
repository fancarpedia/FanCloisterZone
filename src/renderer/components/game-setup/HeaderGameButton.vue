<template>
  <div class="header-game-button">
    <v-btn :large="$vuetify.breakpoint.height > 768" color="primary" :disabled="!engine || !engine.ok || !containsCoreSet || startTileExcluded || disabled" @click="ev => $emit('click', ev)">
      <v-icon left>fas fa-play</v-icon>
      {{ title }}
    </v-btn>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    title: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    sets: { type: Object, required: true }
  },

  computed: {
    ...mapState({
      engine: state => state.engine,
      tileOverrides: state => state.gameSetup.tileOverrides
    }),

    containsCoreSet () {
      return this.sets.basic || this.sets['basic:1'] || this.sets['basic:2'] ||
        this.sets.winter || this.sets['winter:1'] || this.sets['winter:2'] ||
        this.sets.start
    },

    // a game can't be created when a pre-placed starting tile is overridden to 0
    // (keep in sync with HeaderMessage.startTileExcluded, which shows the warning)
    startTileExcluded () {
      if (!this.tileOverrides || !Object.keys(this.tileOverrides).length) return false
      const startTiles = this.$store.getters['gameSetup/selectedStartingTiles']
      if (!startTiles || !startTiles.value) return false
      return startTiles.value.some(({ tile }) => this.tileOverrides[tile] === 0)
    }
  }
}
</script>

<style lang="sass" scoped>
.header-game-button
  display: flex
  align-items: center
  padding-right: 1ex
</style>
