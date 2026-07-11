<template>
  <!-- Keep Building (cooperative variant): this player's turn met neither condition — all lose. -->
  <div class="one-square coop-lost" :title="$t('game.coop.all-lose')">
    <v-icon>fas fa-heart-broken</v-icon>
  </div>
</template>

<script>
export default {
  props: {
    ev: { type: Object, required: true }
  }
}
</script>

<style lang="sass" scoped>
.coop-lost
  display: flex
  align-items: center
  justify-content: center

  i
    font-size: 26px

    +theme using ($theme)
      color: map-get($theme, 'removed-color')
</style>
