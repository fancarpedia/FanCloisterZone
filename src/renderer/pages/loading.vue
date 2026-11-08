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
  // 100vh is measured against the viewport with the mobile URL bar HIDDEN, so it overshoots
  // the visible area while the bar is up. dvh tracks what the player can actually see; the
  // 100vh line above stays as the fallback for browsers without dvh.
  height: 100vh
  height: 100dvh
</style>
