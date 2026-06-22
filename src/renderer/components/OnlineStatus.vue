<template>
  <div class="online-status">
    <span class="text">{{ $t('index.online.connected-to', [isLocalPlayOnline ? 'dev local' : 'fanserver'/*playOnlineHostname*/]) }}</span><!-- /* Fan Edition */ -->
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
  computed: {
    ...mapState({
      playOnlineHostname: state => state.onlineHostName
    }),
    ...mapGetters('settings', ['isLocalPlayOnline'])
  }
}
</script>

<style lang="sass" scoped>
.online-status
  text-align: center
  font-size: 16px
  font-weight: 300

  +theme using ($theme)
    background-color: map-get($theme, 'cards-bg')
    color: map-get($theme, 'gray-text-color')
</style>
