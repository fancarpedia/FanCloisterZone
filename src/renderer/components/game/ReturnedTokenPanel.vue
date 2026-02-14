<template>
  <section @click="onClick">
    <div class="expr-title">
      <div>{{ expr.type }}</div>
      <div v-if="subtitle" class="sub">{{ expr.type }}</div>
    </div>
    <div class="expr-row">
      <div
        :class="expr.player === null || expr.player === undefined ? '' : colorCssClass(expr.player)"
      >	
        <TokenImage
          :token="expr.token"
          :height="40"
        />
      </div>
      <div v-if="expr.forced">
        forced &nbsp;<!-- TRANSLATE -->
      </div>
      <div>
        from
      </div>
      &nbsp;
      <div>
      	<template v-if="expr.from.feature">
      	  {{ expr.from.feature }}
      	</template>
      	<template v-else>
      	  Tile<!-- TRANSLATE -->
      	</template>
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

import { Expansion } from '@/models/expansions'
import ExpressionItem from '@/components/game/ExpressionItem'
import TokenImage from '@/components/game/TokenImage'

const TITLE_MAPPING = {
  'meteorite-impact': 'game.feature.meteorite'
}

const SUBTITLE_MAPPING = {
}

export default {
  components: {
    TokenImage
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
    console.log(this.expr)
      return 'title2';
/*      let title = TITLE_MAPPING[this.expr.name]
      if (title) return this.$t(title)
      title = TITLE_MAPPING[this.expr.name.split('.')[0]]
      if (title) return this.$t(title)
      return this.expr.name*/
    },

    subtitle () {
      return 'subtitle2'
/*      const title = SUBTITLE_MAPPING[this.expr.name]
      if (title !== undefined) return '(' + this.$t(title) + ')'
      const key = this.expr.name.split('.')[1]
      if (!key) return null
      return SUBTITLE_MAPPING[key] !== undefined ? '(' + this.$t(SUBTITLE_MAPPING[key]) + ')' : key*/
    }
  },

  methods: {
    onClick () {
      this.$store.commit('board/returnedTokenPanel', null)
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
  align-items: center
  padding-left: 20px
  font-size: 20px
  font-weight: 300

  .sub
    font-size: 16px
    margin-top: 4px

svg.token, img.token
  max-width: 40px
  height: 40px
</style>
