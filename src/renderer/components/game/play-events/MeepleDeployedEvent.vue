<template>
  <div
    :class="{'meeple-moved': ev.from}"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="one-square">
      <Meeple
        :type="ev.meeple"
        :class="colorCssClass(ev.player)"
      />
    </div>
    <v-icon v-if="ev.from">fas fa-arrow-right</v-icon>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import Meeple from '@/components/game/Meeple'

export default {
  components: {
    Meeple
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: mapGetters({
    tileOn: 'game/tileOn',
    colorCssClass: 'game/colorCssClass'
  }),

  methods: {
    onMouseEnter () {
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'meeple',
            barn: this.ev.meeple === 'Barn',
            obelisk: this.ev.meeple === 'Obelisk',
            ...this.ev.to
          }
        }
      })
      // also draw the actual meeple (type + owner colour) at the deployed spot.
      // Barn/Obelisk are corner-placed (no feature point) — keep the circle only.
      const { to, meeple, player } = this.ev
      if (to && to.location && meeple !== 'Barn' && meeple !== 'Obelisk') {
        this.$store.dispatch('board/showLayer', {
          layer: 'EventMeeplesLayer',
          props: {
            meeples: [{
              type: meeple,
              player,
              position: to.position,
              feature: to.feature,
              location: to.location
            }]
          }
        })
      }
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EventMeeplesLayer' })
    }
  }
}
</script>

<style lang="sass" scoped>
.meeple-moved
  display: flex
  width: 60px

.v-icon
  width: 20px
  font-size: 20px
</style>
