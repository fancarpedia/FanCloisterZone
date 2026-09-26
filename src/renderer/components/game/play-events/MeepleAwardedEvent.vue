<template>
  <div
    class="meeple-awarded"
    :title="$t('game.event.meeple-awarded')"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <v-icon class="plus">fas fa-plus</v-icon>
    <div class="one-square">
      <Meeple
        :type="ev.meeple"
        :class="colorCssClass(ev.player)"
      />
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import Meeple from '@/components/game/Meeple'

// A player was handed a NEW meeple mid-game — today only the Mini Meeple, awarded for placing
// a regular tile into a hole. `ev.position` is that placement, so hovering the history entry
// emphasizes the tile that earned it (same mechanism as TilePlacedEvent).
export default {
  components: {
    Meeple
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: mapGetters({
    colorCssClass: 'game/colorCssClass'
  }),

  methods: {
    onMouseEnter () {
      // describe the award in the ActionPanel, like MeepleReturnedEvent does for returns
      this.$store.commit('board/awardedMeeplePanel', this.ev)
      if (!this.ev.position) return
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
      this.$store.commit('board/awardedMeeplePanel', null)
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
    }
  }
}
</script>

<style lang="sass" scoped>
.meeple-awarded
  display: flex
  align-items: center
  width: 58px

.plus
  width: 18px
  font-size: 14px
</style>
