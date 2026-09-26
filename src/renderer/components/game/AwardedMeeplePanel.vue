<template>
  <section @click="onClick">
    <div class="expr-title">
      <div>{{ $t('game.event.meeple-awarded') }}</div>
      <div v-if="reason" class="sub">{{ $t(reason) }}</div>
    </div>
    <div class="expr-row">
      <div :class="expr.player === null || expr.player === undefined ? '' : colorCssClass(expr.player)">
        <Meeple v-if="expr.meeple" :type="expr.meeple" />
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

import Meeple from '@/components/game/Meeple'

// Hover panel for the `meeple-awarded` history event: a player was handed a NEW meeple during
// play (today only the Mini Meeple, for filling a hole). Mirrors ReturnedMeeplePanel — the
// history event commits the event object to board/awardedMeeplePanel on mouseenter and clears
// it on mouseleave, and ActionPanel renders this in place of the current action.

// Why this meeple was awarded, keyed by the figure that was handed over — the event itself is
// generic. Mini Meeples are earned by filling a hole; a future awarded figure adds a line here
// (and simply gets no second line until it does).
const REASON = {
  MiniFollower: 'game.event.meeple-awarded-hole'
}

export default {
  components: {
    Meeple
  },

  props: {
    expr: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    reason () {
      return REASON[this.expr.meeple] || null
    }
  },

  methods: {
    onClick () {
      this.$store.commit('board/awardedMeeplePanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.expr-row
  display: flex
  align-items: stretch
  justify-content: center
  height: 100%

.expr-title
  position: absolute
  left: 0
  max-width: 50%
  height: var(--action-bar-height)
  line-height: 1
  display: flex
  flex-direction: column
  justify-content: center
  padding-left: 20px
  font-size: 20px
  font-weight: 300

  .sub
    font-size: 16px
    margin-top: 4px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

svg.meeple
  max-width: 40px
  height: 40px
</style>
