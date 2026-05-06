<template>
  <div class="header-change-game-button">
    <v-btn :large="$vuetify.breakpoint.height > 768" color="primary" @click="ev => $emit('click', ev)">
      <v-icon left>fas fa-sliders</v-icon>
      {{ title }}
    </v-btn>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    title: { type: String, required: true },
    disabled: { type: Boolean, default: false }
  }

}
</script>

<style lang="sass" scoped>
.header-change-game-button
  display: flex
  align-items: center
  padding-right: 1ex

  button
    background-color: var(--v-primary-lighten1) !important
  	
</style>
