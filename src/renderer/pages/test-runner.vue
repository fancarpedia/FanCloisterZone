<template>
  <div class="test-runner">
    <v-container class="test-runner-container">
      <div class="test-runner-header">
        <div class="test-runner-header-topbar">

          <h1>{{ $nuxt.$t('dev.test-runner') }} <span class="timer">{{ timerDisplay }}</span></h1>

          <div class="middle">
            <v-btn color="primary" @click="toggleRunAll">
              {{ isRunningAll ? $nuxt.$t('button.stop-running') : $nuxt.$t('button.run-all') }}
            </v-btn>

            <v-btn color="secondary" @click="toggleFinished">
              {{ !hideFinished ? $nuxt.$t('button.hide-finished') : $nuxt.$t('button.show-all') }}
            </v-btn>

            <v-btn color="secondary" @click="resetFailed">
              {{ $nuxt.$t('button.reset-failed') }}
            </v-btn>

            <v-btn color="secondary" @click="resetAll">
              {{ $nuxt.$t('button.reset-all') }}
            </v-btn>
          </div>

          <div>
            <v-btn to="/" color="secondary" class="error close" @click="resetFailed">
              <v-icon left>fa-times</v-icon>
              {{ $t('button.close') }}
            </v-btn>
          </div>
        </div>

        <div class="expansions">
          <div
            v-for="expansion in expansions"
            :key="expansion.name"
            class="set"
            :class="{ selected: selectedExpansions.includes(expansion.name.toLowerCase().replace(/_/g, '-')) }"
            :title="expansion.name"
            @click="toggleExpansion(expansion)"
          >
            <ExpansionSymbol :expansion="expansion" />
          </div>
        </div>
      </div>

      <v-simple-table class="test-runner-table">
        <template v-slot:default>
          <thead>
            <tr>
              <th class="text-left">{{ $nuxt.$t('dev.test') }}</th>
              <th class="text-left">{{ $nuxt.$t('dev.result') }}</th>
              <th class="text-left">{{ $nuxt.$t('dev.actions') }}</th>
            </tr>
          </thead>
          <tbody>
           <template v-for="(test, idx) in filteredTests">
            <tr
              v-if="!hideFinished || !test.result || !test.result.ok"
              :key="test.file"
              :class="{ disabled: test.disabled }"
            >
              <td>
                {{ test.name }}
                <div v-if="test.error" class="error-message">
                  {{ test.error }}
                </div>
              </td>
              <td>
                <span v-if="test.result && test.result.ok">✅ {{ $nuxt.$t('dev.ok') }}</span>
                <span v-else-if="test.result && test.result.error">❌ {{ test.result.error }}</span>
                <span v-else-if="test.result && !test.result.ok">❌ {{ $nuxt.$t('dev.fail') }}</span>
              </td>
              <td>
                <v-btn
                  small
                  color="secondary"
                  @click="run(test, idx)"
                  :disabled="test.disabled"
                >
                  {{ $nuxt.$t('button.run') }}
                </v-btn>
                <v-btn
                  small
                  color="secondary"
                  @click="open(test)"
                  :disabled="test.disabled"
                >
                  {{ $nuxt.$t('button.open') }}
                </v-btn>
              </td>
            </tr>
           </template>
          </tbody>
        </template>
      </v-simple-table>
    </v-container>
  </div>
</template>

<script>
import fs from 'fs'
import path from 'path'
import Vue from 'vue'
import omit from 'lodash/omit'
import { Expansion } from '@/models/expansions'
import ExpansionSymbol from '@/components/ExpansionSymbol'

export default {
  components: {
    ExpansionSymbol
  },

  data() {
    return {
      hideFinished: false,
      isRunningAll: false,
      stopRunning: false,
      tests: [],
      selectedExpansions: [],
      expansions: Expansion.all(),
      timerSeconds: 0,
      timerInterval: null,
    }
  },

  computed: {
    filteredTests () {
      if (this.selectedExpansions.length === 0) return this.tests
      return this.tests.filter(test =>
        this.selectedExpansions.every(exp => test.requiredSets && test.requiredSets.includes(exp))
      )
    },

    timerDisplay () {
      const mins = Math.floor(this.timerSeconds / 60)
      const secs = this.timerSeconds % 60
      return `${mins}:${String(secs).padStart(2, '0')}`
    }
  },

  async asyncData({ store }) {
    const testFolder = path.normalize(
      store.state.settings?.testRunnerFolder || 'engine-tests'
    )
    const tests = []

    const installedSets = Expansion.all().map(e =>
      e.name.toLowerCase().replace(/_/g, '-')
    )

    const processFile = async (filePath, relativeName) => {
      let disabled = false
      let error = []
      let requiredSets = []

      try {
        const fileContent = await fs.promises.readFile(filePath, 'utf-8')
        const json = JSON.parse(fileContent)
        const setsRaw = json?.setup?.sets
        if (!json.hasOwnProperty('test')) {
          disabled = true
          error.push(`Save file has no test defined`)
        }
        requiredSets = Object.keys(setsRaw).map(set =>
          set.split(/:|,v|\//)[0].toLowerCase().replace(/_/g, '-')
        )
        const missing = requiredSets.filter(set => !installedSets.includes(set))
        if (missing.length > 0) {
          disabled = true
          error.push(`Missing expansions: ${missing.join(', ')}`)
        }
      } catch (err) {
        disabled = true
        error.push(`Invalid test file: ${err.message}`)
      }

      tests.push({
        name: relativeName.replace('.jcz', ''),
        file: filePath,
        disabled,
        error: error.join(', '),
        requiredSets
      })
    }
  
    const processFolder = async (folderPath, relativePath) => {
      const listing = await fs.promises.readdir(folderPath)
      for (const entry of listing) {
        const fullPath = path.join(folderPath, entry)
        const relPath = relativePath ? path.join(relativePath, entry) : entry
        const stat = await fs.promises.stat(fullPath)
        if (stat.isDirectory()) {
          await processFolder(fullPath, relPath)
        } else {
          await processFile(fullPath, relPath)
        }
      }
    }
    
    try {
      await processFolder(testFolder, '')
    } catch (e) {
      const realPath = await fs.promises.realpath('.')
      const testFolderPath = path.join(realPath, testFolder)
      console.log(`Test folder ${testFolderPath} does not exist`, e.message)
      return { tests: [] }
    }

    return { tests }
  },

  mounted() {
    this.$store.commit('runningTests', true)
  },

  beforeDestroy() {
    this.$store.commit('runningTests', false)
    this.stopTimer()
  },

  methods: {
    startTimer () {
      this.timerSeconds = 0
      this.timerInterval = setInterval(() => {
        this.timerSeconds++
      }, 1000)
    },

    stopTimer () {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }
    },

    toggleExpansion (expansion) {
      const name = expansion.name.toLowerCase().replace(/_/g, '-')
      const idx = this.selectedExpansions.indexOf(name)
      if (idx === -1) {
        this.selectedExpansions.push(name)
      } else {
        this.selectedExpansions.splice(idx, 1)
      }
    },

    open({ file }) {
      this.$store.commit('runningTests', false)
      this.$store.dispatch('game/load', { file })
    },

    async run(test, idx) {
      if (test.disabled) return
      const globalIdx = this.tests.indexOf(test)
      Vue.set(this.tests, globalIdx, omit(test, ['result']))
      const result = await this.runTest(test.file)
      Vue.set(this.tests, globalIdx, { ...test, result })
    },

    async toggleRunAll() {
      if (!this.isRunningAll) {
        this.isRunningAll = true
        this.stopRunning = false
        this.startTimer()

        for (let idx = 0; idx < this.filteredTests.length; idx++) {
          const test = this.filteredTests[idx]
          if (this.stopRunning) break
          if (test.disabled || test.result) continue
          const globalIdx = this.tests.indexOf(test)
          const result = await this.runTest(test.file)
          Vue.set(this.tests, globalIdx, { ...test, result })
        }

        this.stopTimer()
        this.isRunningAll = false
      } else {
        this.stopRunning = true
        this.isRunningAll = false
        this.stopTimer()
      }
    },

    resetAll() {
      if (this.isRunningAll) {
        this.toggleRunAll()
      }
      this.onlyFailed = false
      this.tests = this.tests.map(test => ({
        ...omit(test, ['result']),
      }))
    },

    resetFailed() {
      this.tests = this.tests.map(test => {
        if (test.result && !test.result.ok) {
          return {
            ...omit(test, ['result']),
          }
        }
        return test
      })
    },

    toggleFinished() {
      this.hideFinished = !this.hideFinished
    },
    
    runTest(file) {
      return new Promise(resolve => {
        const unsubscribe = this.$store.subscribe(async mutation => {
          if (mutation.type === 'game/testScenarioResult') {
            unsubscribe()
            await this.$store.dispatch('game/close')
            const failed = mutation.payload.assertions.find(a => a.result === false)
            setTimeout(() => {
              resolve({
                ...mutation.payload,
                ok: !failed
              })
            }, 100)
          }
        })

        this.$store.dispatch('game/load', { file }).catch(err => {
          resolve({
            ok: false,
            error: err.message || 'Error loading test file'
          })
        })
      })
    }
  }
}
</script>

<style lang="sass" scoped>
.disabled
  opacity: 0.6

.test-runner-container
  display: flex
  flex-direction: column
  height: 100vh
  overflow: hidden

.test-runner-header
  height: auto
  min-height: 70px
  align-items: center
  justify-content: center
  gap: 8px
  padding: 10px 20px
  border-bottom: 1px solid #ddd
  z-index: 10

  > div:not(.expansions)
    display: flex
    align-items: center
    gap: 8px

.test-runner-header-topbar
  display: flex
  
  .middle
    text-align: center

  div:not(.middle), h1
    flex: 0 0 auto
    
  div.middle
    flex: 1

.timer
  font-size: 0.75em
  opacity: 0.75
  margin-left: 10px
  letter-spacing: 0.05em

.expansions
  display: flex
  flex-wrap: wrap
  justify-content: center
  margin-top: 5px

  svg
    cursor: pointer
    width: 32px
    height: 32px
    margin: 2px

    +theme using ($theme)
      fill: map-get($theme, 'text-color')

  .selected svg
    +theme using ($theme)
      fill: var(--v-primary-base)

.test-runner-table
  flex: 1
  overflow-y: auto

.error-message
  font-size: 0.8em

  +theme using ($theme)
    color: map-get($theme, '--v-error-base')
 
.v-btn.close
  padding-left: 12px
  padding-right: 12px
  min-width: inherit
   
@media (max-width: 1024px)
  .close
    text-indent: -9999px
    margin: 0
    min-width: 0
	
    .v-icon
      font-size: 24px
      margin: 0
</style>