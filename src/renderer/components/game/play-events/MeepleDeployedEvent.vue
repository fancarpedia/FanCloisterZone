<template>
  <div
    :class="{'meeple-moved': ev.from}"
    :title="causeTitle"
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
import { causeTitle, withCause } from '@/utils/placement-cause'

export default {
  components: {
    Meeple
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({
      tileOn: 'game/tileOn',
      colorCssClass: 'game/colorCssClass'
    }),

    // what triggered this when no player chose it (engine PlacementCause), as a tooltip
    causeTitle () {
      return causeTitle(this.ev.cause, this) || null
    }
  },

  methods: {
    onMouseEnter () {
      // the action panel tells what happened: deployed or moved by the player of their own will,
      // or placed by the game itself with its cause (a trap, …)
      this.$store.commit('board/placementPanel', {
        kind: this.ev.from ? 'moved' : 'placed',
        meeple: this.ev.meeple,
        player: this.ev.player,
        to: this.ev.to,
        cause: this.ev.cause || null,
        byPlayer: !this.ev.cause
      })
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: withCause({
            type: 'meeple',
            barn: this.ev.meeple === 'Barn',
            obelisk: this.ev.meeple === 'Obelisk',
            ...this.ev.to
          }, this.ev.cause)
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
      this.$store.commit('board/placementPanel', null)
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
