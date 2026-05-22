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

    <h4>{{ $t('settings.system.test-runner-folder') }}</h4>
    <v-text-field
      v-model="testRunnerFolder"
      :error-messages="folderError"
      outlined dense
      hide-details
    />
    
    {{ folderError }}

  </div>
</template>

<script>

import fs from 'fs'
import path from 'path'
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
    
    testRunnerFolder: {
      get () { return this.$store.state.settings.testRunnerFolder ?? '' },
      set (val) {
        const normalized = val ? path.normalize(val.trim()) : ''
	    try {
          const stat = fs.statSync(normalized)
          if (!stat.isDirectory()) {
            this.folderError = this.$t('settings.system.path-is-not-directory')
            return
          }
          this.folderError = null
          this.$store.dispatch('settings/update', { testRunnerFolder: val })
        } catch (e) {
          console.log('THIS',this)
          this.folderError = this.$t('settings.system.folder-does-not-exists')
        }
      }
    },
    
    devChannel: {
      get () { return this.$store.state.settings.devChannel ?? 'stable' },
      set (val) { this.$store.dispatch('settings/update', { devChannel: val }) }
    }
  },
  
  data() {
    return {
      folderError: null
    }
  }
}
</script>
