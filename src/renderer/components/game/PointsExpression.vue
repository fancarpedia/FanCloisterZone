<template>
  <section @click="onClick">
    <div class="expr-title">
      <div>{{ title }}</div>
      <div v-if="subtitle" class="sub">{{ subtitle }}</div>
    </div>
    <div class="expr-row">
      <div class="expr">
        <ExpressionItem
          v-for="(item, idx) in expr.items"
          :key="idx"
          :item="item"
          :index="idx"
        />
      </div>
      <div v-if="expr.items.length" class="equal">=</div>
      <div
        :class="'points ' + colorCssClass(expr.player)"
      >
        {{ expr.points }}
      </div>
    </div>
    <div v-if="majority.length" class="majority">
      <div class="majority-label">{{ $t('game.scoring.majority') }}</div>
      <div class="majority-shares">
        <div
          v-for="(share, idx) in majority"
          :key="idx"
          :class="['share', { winner: share.winner }]"
          :title="share.winner ? $t('game.scoring.majority') : $t('game.scoring.no-majority')"
        >
          <v-icon v-if="share.winner" class="crown">fas fa-crown</v-icon>
          <span v-else class="crown-spacer" />
          <div class="meeple-wrap" :class="colorCssClass(share.player)">
            <Meeple type="SmallFollower" />
          </div>
          <div class="power">{{ share.power }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

import { Expansion } from '@/models/expansions'
import ExpressionItem from '@/components/game/ExpressionItem'
import Meeple from '@/components/game/Meeple'

const TITLE_MAPPING = {
  'acrobats': 'game.feature.acrobats',
  'bigtop': 'game.feature.big-top',
  'city': 'game.feature.city',
  'city.tiny': 'game.feature.city-small',
  'road': 'game.feature.road',
  'monastery': 'game.feature.monastery',
  'church': 'game.feature.church-bonus',
  'shrine': 'game.feature.shrine',
  'garden': 'game.feature.garden',
  'castle': 'game.feature.castle',
  'fairy': 'game.feature.fairy',
  'flock': 'game.feature.flock',
  'wind-rose': 'game.feature.wind-rose',
  'yaga-hut': 'game.feature.yaga-hut',
  'field': 'game.feature.field',
  'trade-goods': 'game.feature.trade-goods',
  'king': 'game.feature.king',
  'ringmaster': 'game.feature.ringmaster',
  'robber': 'game.feature.robber',
  'king+robber': 'game.feature.king-and-robber',
  'special-monastery': 'game.feature.special-monastery',
  'gold': 'game.feature.gold-ingots',
  'vodyanoy': 'game.feature.vodyanoy',
  'watchtower': 'game.feature.watchtower',
  'obelisk': 'game.element.obelisk',
  'windmill': 'game.element.windmill',
  'decinsky-sneznik': 'game.element.decinsky-sneznik',
  'flowers': 'game.feature.flowers',
  'river': 'game.feature.fishermen',
  'courier': 'game.element.courier',
  'fishhut': 'game.feature.fishhut',
  'ransompaid': 'game.action.ransom-paid'
}

const SUBTITLE_MAPPING = {
  'incomplete': 'game.scoring.incomplete',
  'challenged': 'game.scoring.challenged',
  'empty': 'game.scoring.empty',
  'no-majority': 'game.scoring.no-majority',
  'city.tiny': null,
  'fairy.completed': 'game.scoring.feature-scored',
  'fairy.turn': 'game.scoring.turn-start',
  'barn-placed': 'game.scoring.barn-placed',
  'barn-connected': 'game.scoring.barn-connected',
  'payment': 'game.scoring.payment',
  'income': 'game.scoring.income'
}

export default {
  components: {
    ExpressionItem,
    Meeple
  },

  props: {
    expr: { type: Object, required: true }
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
      let title = TITLE_MAPPING[this.expr.name]
      if (title) return this.$t(title)
      title = TITLE_MAPPING[this.expr.name.split('.')[0]]
      if (title) return this.$t(title)
      return this.expr.name
    },

    subtitle () {
      const title = SUBTITLE_MAPPING[this.expr.name]
      if (title !== undefined) {
        if (title === null) return ''
        return '(' + this.$t(title) + ')'
      }
      const key = this.expr.name.split('.')[1]
      if (!key) return null
      if (SUBTITLE_MAPPING[key] !== undefined) return '(' + this.$t(SUBTITLE_MAPPING[key]) + ')'
      if (this.expr.name.split('.')[0] === 'courier') return '(' + (TITLE_MAPPING[this.expr.name.split('.')[1]] !== undefined ? this.$t(TITLE_MAPPING[this.expr.name.split('.')[1]]) : '') + ')'
      return key
    },

    majority () {
      // winners first, then strongest to weakest
      return [...(this.expr.majority || [])].sort((a, b) => (b.winner - a.winner) || (b.power - a.power))
    }
  },

  methods: {
    onClick () {
      this.$store.commit('board/pointsExpression', null)
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
  max-width: 210px
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

.majority
  position: absolute
  right: 0
  height: var(--action-bar-height)
  display: flex
  flex-direction: column
  justify-content: center
  align-items: flex-end
  padding-right: 18px

  .majority-label
    font-size: 14px
    font-weight: 300
    opacity: 0.7
    margin-bottom: 2px

  .majority-shares
    display: flex
    align-items: flex-end

  .share
    display: flex
    flex-direction: column
    align-items: center
    margin-left: 10px
    opacity: 0.4
    filter: grayscale(0.45)
    transition: opacity 0.15s ease

    &.winner
      opacity: 1
      filter: none

    .crown
      font-size: 13px
      height: 15px
      color: #f1c40f

    .crown-spacer
      height: 15px

    .meeple-wrap
      width: 30px
      height: 30px
      display: flex
      align-items: center
      justify-content: center

      svg.meeple
        width: 30px
        height: 30px

    .power
      font-size: 16px
      font-weight: 600
      line-height: 1
      margin-top: 1px
</style>
