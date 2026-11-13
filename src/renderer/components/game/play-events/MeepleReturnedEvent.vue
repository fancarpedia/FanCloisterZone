<template>
  <div
    class="one-square meeple-returned"
    :class="colorCssClass(ev.player)"
    :title="causeTitle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <Meeple :type="ev.meeple" />
    <v-icon>fas fa-slash</v-icon>
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
      if (this.ev.cause) {
        // returned by the game itself (meteorite, wolf, dragon, …): say what caused it
        this.$store.commit('board/placementPanel', {
          kind: 'removed',
          meeple: this.ev.meeple,
          player: this.ev.player,
          cause: this.ev.cause
        })
      } else {
        this.$store.commit('board/returnedMeeplePanel', this.ev)
      }
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: withCause({
            type: 'meeple',
            ...this.ev.from
          }, this.ev.cause)
        }
      })
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.commit('board/returnedMeeplePanel', null)
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.meeple-returned
  position: relative

  i
    position: absolute
    left: -1px
    top: 2px
    font-size: 34px

    +theme using ($theme)
      color: map-get($theme, 'removed-color')
</style>
