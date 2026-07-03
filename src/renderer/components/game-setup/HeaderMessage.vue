<template>
  <div class="header-message">
    <div v-if="engine && engine.error" class="warning-text">
      {{ $t('core-messages.game-engine-not-available') }}
    </div>
    <div v-else-if="!containsCoreSet" class="info-text">
      {{ $t('core-messages.no-core-set') }}
    </div>
    <div v-else-if="startTileExcluded" class="warning-text">
      {{ $t('game-setup.start-tile-excluded') }}
    </div>
    <div v-else-if="info" class="info-text">
      {{ info }}
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    info: { type: String, default: null },
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

    // a pre-placed starting tile whose count was overridden to 0 cannot be drawn from the pack
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
.header-message
  display: flex
  align-items: center

.warning-text, .info-text
  font-size: 24px
  white-space: nowrap
  color: white
  margin-right: 20px
  padding: 0 10px
  border-radius: 4px

.warning-text
  background-color: #F44336

.info-text
  background-color: #3F51B5
</style>
