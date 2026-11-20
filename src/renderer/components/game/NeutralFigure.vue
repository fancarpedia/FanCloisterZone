<template>
  <svg :class="`neutral ${symbol}` ">
    <use :href="`${NEUTRAL_SVG}#${symbol}`" />
  </svg>
</template>

<script>
const NEUTRAL_SVG = require('~/assets/neutral.svg')

export default {

  props: {
    figure: { type: String, required: true }
  },

  computed: {
    // the engine's figure id → its symbol in neutral.svg (the Big Top is "bigtop" in the engine)
    symbol () {
      return this.figure === 'bigtop' ? 'big-top' : this.figure
    }
  },

  data () {
    return {
      NEUTRAL_SVG
    }
  }
}
</script>
