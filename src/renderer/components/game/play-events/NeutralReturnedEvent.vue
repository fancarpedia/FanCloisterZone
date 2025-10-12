<template>
  <div
    class="neutral-returned"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <NeutralFigure :figure="figure" :width="34" :height="34" />
    <v-icon v-if="!ev.to">fas fa-slash</v-icon>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import NeutralFigure from '@/components/game/NeutralFigure'

export default {
  components: {
    NeutralFigure
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({ tileOn: 'game/tileOn' }),

    figure () {
      return this.ev.figure.toLowerCase()
    }
  },

  methods: {
    onMouseEnter () {
      const { from } = this.ev
      console.log(3,from)		
      if (!from) {
        return
      }
      console.log(2,this.ev)		
      this.$store.commit('board/returnedMeeplePanel', this.ev)

      let fp = null
      if (from.featurePointer) {
        fp = from.featurePointer
      } else if (from.position && from.location) {
        fp = from
      }

      if (fp) {
        this.$store.dispatch('board/showLayer', {
          layer: 'EmphasizeLayer',
          props: {
            emphasis: {
              type: 'meeple',
              ...fp
            }
          }
        })
      } else if (this.ev.from.length === 2) { // position
        this.$store.dispatch('board/showLayer', {
          layer: 'EmphasizeLayer',
          props: {
            emphasis: {
              type: 'tile',
              position: this.ev.from
            }
          }
        })
      }
    },

    onMouseLeave () {
      this.$store.commit('board/returnedMeeplePanel', null)
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
    }
  }
}
</script>

<style lang="sass" scoped>
.neutral-returned
  position: relative

  i
    position: absolute
    left: -1px
    top: 2px
    font-size: 34px

    +theme using ($theme)
      color: map-get($theme, 'removed-color')
</style>
