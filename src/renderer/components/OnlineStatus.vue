<template>
  <div class="online-status" :class="{ offline: !connected && !connecting }">
    <span v-if="connected" class="text">{{ $t('index.online.connected-to', [isLocalPlayOnline ? 'dev local' : 'fanserver'/*playOnlineHostname*/]) }}</span><!-- /* Fan Edition */ -->
    <span v-else-if="connecting" class="text">{{ $t('index.online.connecting') }}</span>
    <span v-else class="text">{{ $t('index.online.offline') }}</span>
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
