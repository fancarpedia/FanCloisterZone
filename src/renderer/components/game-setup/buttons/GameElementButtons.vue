<template>
  <QuantityButtons
    v-model="quantity"
    :max="max"
    :min="min"
    :mutable="mutable"
    :reset="reset"
    :show-number="showNumber"
    :default-value="defaultValue"
  >
    <slot />

    <template v-if="$slots.hover" #hover>
      <slot name="hover" />
    </template>
  </QuantityButtons>
</template>

<script>
import QuantityButtons from '@/components/game-setup/buttons/QuantityButtons'

// TODO merge with set buttons
export default {
  components: {
    QuantityButtons
  },

  props: {
    item: { type: Object, required: true },
    mutable: { type: Boolean, default: true },
    min: { type: Number, required: false, default: 1 },
    max: { type: Number, required: true },
    reset: { type: Number, default: null },
    showNumber: { type: Boolean, default: false },
    defaultValue: { type: Number, default: null }
  },

  computed: {
    quantity: {
      get () {
        // TODO index state by model name or put prop on model
        const config = this.$store.state.gameSetup.elements || {}
        return config[this.item.id] || (this.item.configType === Boolean ? false : 0)
      },

      set (value) {
        this.$store.dispatch('gameSetup/setElementConfig', { id: this.item.id, config: value })
      }
    }
  }
}
</script>

<style lang="sass" scoped>
</style>
