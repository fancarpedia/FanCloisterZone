<template>
  <div
    class="token-removed points align-center"
    :class="{wide: ev.count > 1}"
    :title="causeTitle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <span v-if="ev.count > 1" class="count">{{ ev.count }}&thinsp;&times;&thinsp;</span>
    <TokenImage :token="ev.token" :height="ev.token === 'GOLD' ? 20 : 26" />
    <v-icon>fas fa-slash</v-icon>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import TokenImage from '@/components/game/TokenImage'
import { causeTitle, withCause } from '@/utils/placement-cause'

export default {
  components: {
    TokenImage
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({
      tileOn: 'game/tileOn',
      featureOn: 'game/featureOn'
    }),

    // what triggered this when no player chose it (engine PlacementCause), as a tooltip
    causeTitle () {
      return causeTitle(this.ev.cause, this) || null
    }
  },

  methods: {
    onMouseEnter () {
      if (this.ev.cause) {
        // removed by the game itself (a meteorite, …): say what caused it
        this.$store.commit('board/placementPanel', { kind: 'removed', token: this.ev.token, cause: this.ev.cause })
      } else {
        this.$store.commit('board/returnedTokenPanel', this.ev)
      }
      const emphasis = withCause({
        type: 'tile',
        position: this.ev.from
      }, this.ev.cause)
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis
        }
      })
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.commit('board/returnedTokenPanel', null)
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.token-removed
  width: 40px
  height: 40px
  font-size: 18px
  border-radius: 13px
  display: flex
  justify-content: center
  align-items: stretch
  position: relative

  &.wide
    width: 80px

  i
    position: absolute
    right: -1px
    top: 2px
    font-size: 34px

    +theme using ($theme)
      color: map-get($theme, 'removed-color')
</style>
