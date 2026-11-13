<template>
  <TokenImage
    token="CASTLE"
    :player="ev.player"
    :height="26"
    @mouseenter.native="onMouseEnter"
    @mouseleave.native="onMouseLeave"
  />
</template>

<script>
import TokenImage from '@/components/game/TokenImage'

export default {
  components: {
    TokenImage
  },

  props: {
    ev: { type: Object, required: true },
    // the player whose turn it was — who converted the small city into a castle
    player: { type: Number, default: null }
  },

  methods: {
    onMouseEnter () {
      // the action panel: a castle token turned the small city into a castle, the player's choice
      this.$store.commit('board/placementPanel', {
        kind: 'placed',
        token: 'CASTLE',
        player: this.player,
        byPlayer: true,
        titleKey: 'game.placement.title.castle-created',
        byKey: 'game.placement.converted-by'
      })
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'castle',
            positions: this.ev.positions
          }
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
</style>
