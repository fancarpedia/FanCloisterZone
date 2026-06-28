<template>
  <div class="loading-window">
    <v-progress-circular indeterminate size="48" color="primary" />
  </div>
</template>

<script>
// Neutral holding page shown in a freshly-opened game window until its launch intent
// (new/load/join/create) is received and dispatched — avoids flashing the lobby.
export default {
}
</script>

<style lang="sass" scoped>
.loading-window
  display: flex
  align-items: center
  justify-content: center
  height: 100vh
</style>
