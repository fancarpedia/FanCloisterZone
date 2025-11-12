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
          text: ['Stable',this.$t('settings.system.stable')].join(': '),
          id: 'stable'
        },
        {
          text: ['Beta',this.$t('settings.system.beta')].join(': '),
          id: 'beta'
        },
        {
          text: ['Dev',this.$t('settings.system.dev')].join(': '),
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
