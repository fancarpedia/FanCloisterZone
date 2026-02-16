<template>
  <img
    :src="towerImage"
    :height="$vuetify.breakpoint.height > 768 ? 55 : 39"
  >
</template>
<script>
import LayeredItemMixin from '@/components/game/actions/items/LayeredItemMixin.js'
export default {
  mixins: [LayeredItemMixin],
  props: {
    options: { type: Array, required: true },
    token: { type: String, required: true },
    active: { type: Boolean }
  },
  computed: {
    layers () {
      return [['TowerSelectLayer', {
        options: this.options,
        token: this.token
      }]]
    },
    towerImage () {
      if (this.token === 'BLACK_TOWER_PIECE') {
        return require('~/assets/figures/black_tower.png')
      }
      if (this.token === 'WHITE_TOWER_PIECE') {
        return require('~/assets/figures/white_tower.png')
      }
      return require('~/assets/figures/tower.png')
    }
  },
  mounted () {
    this.$root.$on('tower.select', this.onSelect)
  },
  beforeDestroy () {
    this.$root.$off('tower.select', this.onSelect)
  },
  methods: {
    async onSelect (position) {
      if (this.active) {
        await this.$store.dispatch('game/apply', {
          type: 'PLACE_TOKEN',
          payload: {
            token: this.token,
            pointer: {
              position,
              feature: 'Tower',
              location: 'I'
            }
          }
        })
      }
    }
  }
}
</script>
