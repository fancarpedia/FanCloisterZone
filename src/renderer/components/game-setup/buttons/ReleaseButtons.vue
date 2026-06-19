<template>
  <QuantityButtons
    v-model="quantity"
    :min="min || 1"
    :max="max || 3"
    :mutable="mutable"
  >
    <slot />
  </QuantityButtons>
</template>

<script>
import isNil from 'lodash/isNil'

import QuantityButtons from '@/components/game-setup/buttons/QuantityButtons'

const DEFAULT_MAX = 3
const DEFAULT_MIN = 1

export default {
  components: {
    QuantityButtons
  },

  props: {
    release: { type: Object, required: true },
    mutable: { type: Boolean, default: true }
  },

  computed: {
    max () {
      let mx = isNil(this.release.max) ? DEFAULT_MAX : this.release.max
      this.release.sets.forEach(s => {
        if (!isNil(s.max)) {
          mx = Math.min(mx, s.max)
        }
      })
      return mx
    },

    min () {
      let mn = isNil(this.release.min) ? DEFAULT_MIN : this.release.min
      this.release.sets.forEach(s => {
        if (!isNil(s.min)) {
          mn = Math.min(mn, s.min)
        }
      })
      return mn
    },

    quantity: {
      get () {
        const sets = this.$store.state.gameSetup.sets || {}
        // some set may be disable due requirements, use max
        return Math.max(...this.release.sets.map(id => sets[id] || 0))
      },

      set (value) {
        this.$store.dispatch('gameSetup/setReleaseQuantity', { release: this.release, quantity: value })
      }
    }
  }
}
</script>

<style lang="sass" scoped>
</style>
