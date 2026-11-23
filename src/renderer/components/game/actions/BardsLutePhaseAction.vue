<template>
  <!-- Bards of Carcassonne: after a lute tile is placed the player puts a note on one free city /
       road / field of that tile (mandatory — no pass button), before any meeple -->
  <section>
    <div class="text">
      {{ local ? $t('game.action.bards-place-a-note') : $t('game.action.bards-player-must-place-a-note') }}
      <img src="~/assets/figures/bards_note.png" :height="$vuetify.breakpoint.height > 768 ? 34 : 24">
    </div>
  </section>
</template>

<script>
export default {
  props: {
    action: { type: Object, required: true },
    phase: { type: String, required: true },
    local: { type: Boolean }
  },

  computed: {
    actionItem () {
      return this.action.items[0]
    }
  },

  watch: {
    actionItem () {
      this.showLayer()
    }
  },

  mounted () {
    this.$root.$on('feature.select', this.onSelect)
    this.showLayer()
  },

  beforeDestroy () {
    this.$root.$off('feature.select', this.onSelect)
    this.hideLayer()
  },

  methods: {
    // the free areas of the lute tile, highlighted on the board (local player only)
    showLayer () {
      if (this.local && this.actionItem) {
        this.$store.dispatch('board/showLayer', {
          layer: 'FeatureSelectLayer',
          props: { options: this.actionItem.options }
        })
      }
    },

    hideLayer () {
      this.$store.dispatch('board/hideLayer', { layer: 'FeatureSelectLayer' })
    },

    async onSelect (opt) {
      if (this.local) {
        await this.$store.dispatch('game/apply', {
          type: 'PLACE_TOKEN',
          payload: {
            token: 'BARDS_NOTE',
            pointer: opt
          }
        })
      }
    }
  }
}
</script>

<style lang="sass" scoped>
img
  margin-left: 30px
  vertical-align: middle
</style>
