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

    <template v-if="isWindows">
      <h4>{{ $t('settings.system.taskbar.title') }}</h4>
      <v-radio-group v-model="windowsTaskbarMode" class="mt-1" hide-details>
        <v-radio value="separate" :label="$t('settings.system.taskbar.separate')" />
        <v-radio value="grouped" :label="$t('settings.system.taskbar.grouped')" />
      </v-radio-group>
      <div class="taskbar-hint">{{ $t('settings.system.taskbar.hint') }}</div>
    </template>

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
import { ipcRenderer } from 'electron'
import { mapState } from 'vuex'

export default {
  computed: {
    isWindows () {
      return process.platform === 'win32'
    },

    windowsTaskbarMode: {
      get () { return this.$store.state.settings.windowsTaskbarMode ?? 'separate' },
      set (val) {
        this.$store.dispatch('settings/update', { windowsTaskbarMode: val })
        // Apply immediately (pass the value so the main process doesn't race the settings save).
        ipcRenderer.invoke('taskbar.set-mode', val)
      }
    },

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

<style lang="sass" scoped>
.taskbar-hint
  margin: -4px 0 16px
  font-size: 13px
  opacity: 0.7
</style>
