<template>
  <section @click="onClick">
    <div class="expr-title">
      <div>{{ title }}</div>
      <div v-if="subtitle" class="sub">{{ subtitle }}</div>
    </div>
    <div class="expr-row">
      <div class="dice">
      	<Dice :value="expr.value" />
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

import Dice from '@/components/game/tokens/Dice'

const TITLE_MAPPING = {
  'meteorite-impact': 'game.action.meteorite-impact'
}

export default {
  components: {
    Dice
  },

  props: {
    expr: { type: Object, required: false }
  },

  computed: {
    title () {
      const action = this.expr.action.split('.')
      let title = TITLE_MAPPING[action[0]]
      if (title) return this.$t(title)
      return action[0];
    },

    subtitle () {
      const action = this.expr.action.split('.')
      if (action[0] == 'meteorite-impact') {
        return this.$t('game-setup.variant.meteorite-impact.'+action[1]);
      } else {
        return action[1] ?? '';
      }
    }
  },

  methods: {
    onClick () {
      this.$store.commit('board/diceRollPanel', null)
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

  .dice
    width: 50px
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

svg.meeple
  max-width: 40px
  height: 40px
</style>
