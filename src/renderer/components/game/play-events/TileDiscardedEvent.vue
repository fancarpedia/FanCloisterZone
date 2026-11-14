<template>
  <!-- hovered: the action panel tells what happened (PlacementPanel) — a drawn tile that fits
       nowhere on the board, discarded -->
  <div
    class="one-square tile-discarded"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <StandaloneTileImage
      :tile-id="ev.tile"
    />
    <v-icon>fas fa-slash</v-icon>
  </div>
</template>

<script>
import StandaloneTileImage from '@/components/game/StandaloneTileImage'

export default {
  components: {
    StandaloneTileImage
  },

  props: {
    ev: { type: Object, required: true }
  },

  methods: {
    onMouseEnter () {
      this.$store.commit('board/placementPanel', {
        kind: 'discarded',
        tile: { id: this.ev.tile, rotation: 0 },
        titleKey: 'game.placement.title.discarded',
        subtitleKey: 'game.placement.discarded-reason'
      })
    },

    onMouseLeave () {
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.tile-discarded
  position: relative

  i
    position: absolute
    left: -1px
    top: 2px
    font-size: 34px

    +theme using ($theme)
      color: map-get($theme, 'removed-color')
</style>
