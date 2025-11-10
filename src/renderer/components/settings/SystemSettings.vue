<template>
  <div>
    <h3 class="mt-2 mb-4">{{ $t('settings.system.title') }}</h3>

    <h4>{{ $t('settings.system.app-channel') }}</h4>
    <v-select
      v-model="devChannel"
      :items="devChannels"
      class="locale"
      item-value="id"
      single-line
    />
  </div>
</template>

<script>

import { mapState } from 'vuex'

export default {
  computed: {
    devChannels() {
      return [
        {
          text: this.$t('settings.system.stable'),
          id: 'stable'
        },
        {
          text: this.$t('settings.system.beta'),
          id: 'beta'
        },
        {
          text: this.$t('settings.system.dev'),
          id: 'dev'
        }
      ]
    },
    
    devChannel: {
      get () { return this.$store.state.settings.devChannel ?? 'beta' },
      set (val) { this.$store.dispatch('settings/update', { devChannel: val }) }
    }
  }
}
</script>
