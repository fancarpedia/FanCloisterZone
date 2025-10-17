<template>
  <div class="header-leavegame-button">
    <v-btn :large="$vuetify.breakpoint.height > 768" color="error" @click="ev => $emit('click', ev)">
      <v-icon>fas fa-xmark</v-icon>
    </v-btn>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    disabled: { type: Boolean, default: false },
  }
}
</script>

<style lang="sass" scoped>
.header-leavegame-button
  display: flex
  align-items: center
  padding-left: 1ex
  
  button.v-btn
    padding: 0
    min-width: 36px
</style>
