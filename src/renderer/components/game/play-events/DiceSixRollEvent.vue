<template>
  <div
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <svg viewBox="0 0 120 120">
      <rect width="120" height="120" fill="white" />
      <circle v-if="ev.value === 1 || ev.value === 3 || ev.value === 5" cx="60" cy="60" r="12" />
      <circle v-if="ev.value === 3 || ev.value === 4 || ev.value === 5 || ev.value === 6" cx="90" cy="30" r="12" />
      <circle v-if="ev.value === 3 || ev.value === 4 || ev.value === 5 || ev.value === 6" cx="30" cy="90" r="12" />
      <circle v-if="ev.value === 4 || ev.value === 5 || ev.value === 6" cx="90" cy="90" r="12" />
      <circle v-if="ev.value === 4 || ev.value === 5 || ev.value === 6" cx="30" cy="30" r="12" />
      <circle v-if="ev.value === 6" cx="60" cy="90" r="12" />
      <circle v-if="ev.value === 6" cx="60" cy="30" r="12" />
      <circle v-if="ev.value === 2" cx="40" cy="80" r="12" />
      <circle v-if="ev.value === 2" cx="80" cy="40" r="12" />
    </svg>
  </div>
</template>

<script>
export default {
  props: {
    ev: { type: Object, required: true }
  },

  methods: {
    onMouseEnter () {
      this.$store.commit('board/diceRollPanel', { type: 'dicesix', value: this.ev.value, action: this.ev.action })
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'tiles',
            positions: this.ev.positions
          }
        }
      });
    },

    onMouseLeave () {
      this.$store.commit('board/diceRollPanel', null)
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
    }
  }
}
</script>

<style lang="sass" scoped>
svg
  display: block
  width: 40px
  height: 40px
</style>
