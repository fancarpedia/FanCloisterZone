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
    ev: { type: Object, required: true },
    // the player whose turn it was — who used the Princess / Robber's Son / Festival …
    // (ev.player is the owner of the returned meeple)
    player: { type: Number, default: null }
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
      } else if (this.ev.source) {
        // removed through a special figure / tile (Princess, Robber's Son, Festival, …): what
        // removed which meeple, and which player used it
        this.$store.commit('board/placementPanel', {
          kind: 'removed',
          meeple: this.ev.meeple,
          player: this.ev.player,
          actor: this.player,
          source: this.ev.source
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
      // the removed meeple drawn back at the spot it left, as a score event shows returned meeples
      const from = this.ev.from && (this.ev.from.featurePointer || this.ev.from)
      if (from && from.position && from.location) {
        this.$store.dispatch('board/showLayer', {
          layer: 'EventMeeplesLayer',
          props: {
            meeples: [{
              type: this.ev.meeple,
              player: this.ev.player,
              position: from.position,
              feature: from.feature,
              location: from.location
            }],
            winners: []
          }
        })
      }
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EventMeeplesLayer' })
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
