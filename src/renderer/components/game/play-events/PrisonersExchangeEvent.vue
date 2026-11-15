<template>
  <!-- Two captured followers swapped back to their owners (Tower): both behind prison bars, the
       exchange between them. Hovered, the action panel explains it (PlacementPanel). -->
  <div
    class="exchange-event"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <template v-for="(f, i) in prisoners">
      <v-icon v-if="i > 0" :key="'x' + i">fas fa-exchange-alt</v-icon>
      <div :key="'m' + i" class="one-square prisoner">
        <Meeple :type="f.type" :class="colorCssClass(f.player)" />
        <svg class="prison-bars" viewBox="0 0 40 40" aria-hidden="true">
          <rect x="1" y="2" width="38" height="3" rx="1" />
          <rect x="1" y="35" width="38" height="3" rx="1" />
          <rect v-for="x in [6, 14, 22, 30]" :key="x" :x="x" y="2" width="3" height="36" rx="1" />
        </svg>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import Meeple from '@/components/game/Meeple'

// The exchanged followers: both of them (engine `followers`, shown in reverse order), or — from
// an engine before that — the only one it sent. Used for the history and the panel alike.
export const exchangedPrisoners = ev => {
  if (Array.isArray(ev.followers) && ev.followers.length) return [...ev.followers].reverse()
  return (ev.exchange || []).filter(f => f && f.type)
}

export default {
  components: {
    Meeple
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    prisoners () {
      return exchangedPrisoners(this.ev)
    }
  },

  methods: {
    onMouseEnter () {
      this.$store.commit('board/placementPanel', {
        kind: 'exchanged',
        titleKey: 'game.placement.title.exchanged',
        subtitleKey: 'game.placement.exchanged-reason',
        prisoners: this.prisoners
      })
    },

    onMouseLeave () {
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.exchange-event
  display: flex
  align-items: center

  .v-icon
    width: 28px

.prisoner
  position: relative

  // as in the player panel's prisoners (PlayerPanel.vue)
  svg.prison-bars
    position: absolute
    left: 0
    top: 0
    width: 40px
    height: 40px
    pointer-events: none
    fill: rgba(40, 40, 40, 0.85)
    stroke: rgba(255, 255, 255, 0.6)
    stroke-width: 0.6
</style>
