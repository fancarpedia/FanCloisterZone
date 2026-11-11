<template>
  <section>
    <div class="text">
      {{ local ? $t('game.action.score-first-choose') : $t('game.action.score-first-player-must-choose') }}
    </div>
  </section>
</template>

<script>
import LayeredItemMixin from '@/components/game/actions/items/LayeredItemMixin.js'

// Shown while ScoringPhase waits for SCORE_FIRST: two or more completed features sit beside one
// castle, the castle takes the points of whichever is scored first, and the turn player decides.
// The choice is made on the board - the contested features are highlighted and clicked - exactly
// as acrobats are picked (ScoreAcrobatsItem). Only the turn player gets the clickable layer.
export default {
  mixins: [LayeredItemMixin],

  props: {
    action: { type: Object, required: true },
    phase: { type: String, required: true },
    local: { type: Boolean }
  },

  computed: {
    // LayeredItemMixin shows the layer while `active`
    active () {
      return this.local
    },

    item () {
      return this.action.items.find(i => i.type === 'ScoreFirst')
    },

    layers () {
      return [['FeatureSelectLayer', {
        player: this.action.player,
        options: this.item ? this.item.options : [],
        // the question is which FEATURE scores first, so show each one whole - a 3-tile road
        // drawn as the single segment on the new tile would look like a 1-tile road
        wholeFeature: true
      }]]
    }
  },

  mounted () {
    this.$root.$on('feature.select', this.onSelect)
  },

  beforeDestroy () {
    this.$root.$off('feature.select', this.onSelect)
  },

  methods: {
    async onSelect (pointer) {
      if (this.active && this.item) {
        await this.$store.dispatch('game/apply', {
          type: 'SCORE_FIRST',
          payload: { pointer }
        })
      }
    }
  }
}
</script>
