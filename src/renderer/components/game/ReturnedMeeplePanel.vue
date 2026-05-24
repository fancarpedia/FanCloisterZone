<template>
  <section @click="onClick">
    <div class="expr-title">
      <div>{{ title }}</div>
    </div>
    <div class="expr-row">
      <div
        :class="expr.player === null || expr.player === undefined ? '' : colorCssClass(expr.player)"
      >	
        <Meeple v-if="expr.meeple" :type="expr.meeple" />
        <NeutralFigure v-else-if="expr.figure" :figure="expr.figure.toLowerCase()" />
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

import { Expansion } from '@/models/expansions'
import ExpressionItem from '@/components/game/ExpressionItem'
import Meeple from '@/components/game/Meeple'
import NeutralFigure from '@/components/game/NeutralFigure'

const TITLE_MAPPING = {
  'MONASTERY_SHRINE_CHALLENGE': 'game.feature.shrine-challenge',
  'SIEGE_ESCAPE': 'game.feature.escape'
}

const SUBTITLE_MAPPING = {
  'incomplete': 'game.scoring.incomplete',
  'challenged': 'game.scoring.challenged',
  'empty': 'game.scoring.empty',
  'city.tiny': null,
  'fairy.completed': 'game.scoring.feature-scored',
  'fairy.turn': 'game.scoring.turn-start',
  'barn-placed': 'game.scoring.barn-placed',
  'barn-connected': 'game.scoring.barn-connected'
}

export default {
  components: {
    Meeple,
    NeutralFigure
  },

  props: {
    expr: { type: Object, required: false }
  },

  data () {
    return {
      Expansion
    }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    title () {
      let title = TITLE_MAPPING[this.expr.source]
      if (title) return this.$t(title)
      return this.expr.source
    },
  },
  
  methods: {
    onClick () {
      this.$store.commit('board/returnedMeeplePanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.expr-row
  display: flex
  align-items: stretch
  height: 100%

  justify-content: center

  .points, .equal
    text-align: center
    font-size: 28px
    font-weight: 500
    align-self: center

  .equal
    margin-right: 12px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  .points
    width: 69px
    border-radius: 23px

  .expr
    display: flex
    align-items: stretch
    font-size: 28px
    font-weight: 500
    padding-top: 1px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

.expr-title
  position: absolute
  left: 0
  max-width:50%
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

svg.meeple, svg.neutral
  max-width: 40px
  height: 40px
</style>
