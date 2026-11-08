<template>
  <StandaloneTileImage
    :tile-id="ev.tile"
    :rotation="ev.rotation"
    :title="ev.historyKey"
    @mouseenter.native="onMouseEnter"
    @mouseleave.native="onMouseLeave"
  />
</template>

<script>
import StandaloneTileImage from '@/components/game/StandaloneTileImage'

export default {
  components: {
    StandaloneTileImage
  },

  // `ev.historyKey` is set only in dev builds (PlayEvents): hovering the tile then says where
  // this event lives in the raw history, e.g. history[12].events[3]. Undefined elsewhere, which
  // renders no title attribute at all.
  props: {
    ev: { type: Object, required: true }
  },

  methods: {
    onMouseEnter () {
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'tile',
            position: this.ev.position
          }
        }
      })
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
    }
  }
}
</script>
