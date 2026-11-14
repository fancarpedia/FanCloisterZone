<template>
  <div class="online-status" :class="{ offline: !connected && !connecting }">
    <!-- connected: nothing to say (the Create / Join buttons beside it are live); only the
         connecting and offline states are shown -->
    <span v-if="connecting" class="text">{{ $t('index.online.connecting') }}</span>
    <span v-else-if="!connected" class="text">{{ $t('index.online.offline', [isLocalPlayOnline ? 'dev local' : 'fanserver']) }}</span>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

import { STATUS_CONNECTED, STATUS_CONNECTING, STATUS_RECONNECTING } from '@/store/networking'

export default {
  computed: {
    ...mapState({
      playOnlineHostname: state => state.onlineHostName,
      connected: state => state.networking.connectionStatus === STATUS_CONNECTED,
      connecting: state => state.networking.connectionStatus === STATUS_CONNECTING || state.networking.connectionStatus === STATUS_RECONNECTING
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

  &.offline
    opacity: 0.7
</style>
