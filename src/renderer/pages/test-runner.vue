<template>
  <div class="test-runner">

    <v-container class="test-runner-container">
      <div class="test-runner-header">
        <h1>Test Runner</h1>

        <div>
          <v-btn color="primary" @click="toggleRunAll">
            {{ isRunningAll ? 'Stop running all' : 'Run All' }}
          </v-btn>

          <v-btn color="secondary" @click="toggleFinished">
            {{ !hideFinished ? 'Hide finished' : 'Show All' }}
          </v-btn>

          <v-btn color="secondary" @click="resetFailed">
            Reset Failed
          </v-btn>

          <v-btn color="secondary" @click="resetAll">
            Reset All
          </v-btn>

        </div>
        <v-btn to="/" color="secondary" class="error" @click="resetFailed">
          Close
        </v-btn>

      </div>

      <v-simple-table class="test-runner-table">
        <template v-slot:default>
          <thead>
            <tr>
              <th class="text-left">Test</th>
              <th class="text-left">Result</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
           <template v-for="(test, idx) in tests">
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
                <span v-if="test.result && test.result.ok">✅ OK</span>
                <span v-else-if="test.result && test.result.error">❌ {{ test.result.error }}</span>
                <span v-else-if="test.result && !test.result.ok">❌ FAIL</span>
              </td>
              <td>
                <v-btn
                  small
                  color="secondary"
                  @click="run(test, idx)"
                  :disabled="test.disabled"
                >
                  Run
                </v-btn>
                <v-btn
                  small
                  color="secondary"
                  @click="open(test)"
                  :disabled="test.disabled"
                >
                  Open
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

export default {
  data() {
    return {
      hideFinished: false,
   	  isRunningAll: false,
      stopRunning: false,
      tests: []
    }
  },

  async asyncData() {
    const testFolder = path.join('engine-tests')
    const tests = []

    const installedSets = Expansion.all().map(e =>
      e.name.toLowerCase().replace(/_/g, '-')
    )

    try {
      const listing = await fs.promises.readdir(testFolder)
      for (const subfolder of listing) {
        const files = await fs.promises.readdir(path.join(testFolder, subfolder))
        for (const f of files) {
          const filePath = path.join(testFolder, subfolder, f)
          let disabled = false
          let error = null

          try {
            const fileContent = await fs.promises.readFile(filePath, 'utf-8')
            const json = JSON.parse(fileContent)
            const setsRaw = json?.setup?.sets
            const requiredSets = Object.keys(setsRaw).map(set =>
              set.split(/:|,v|\//)[0].toLowerCase().replace(/_/g, '-')
            );
            const missing = requiredSets.filter(set => !installedSets.includes(set))
            if (missing.length > 0) {
              disabled = true
              error = `Missing expansions: ${missing.join(', ')}`
            }
          } catch (err) {
            disabled = true
            error = `Invalid test file: ${err.message}`
          }

          tests.push({
            name: path.join(subfolder, f).replace('.jcz', ''),
            file: filePath,
            disabled,
            error
          })
        }
      }
    } catch (e) {
      const realPath = await fs.promises.realpath('.')
      const testFolderPath = path.join(realPath, testFolder)
      console.log(`Test folder ${testFolderPath} does not exist`,e.message)
      return { tests: [] }
    }

    return { tests }
  },

  mounted() {
    this.$store.commit('runningTests', true)
  },

  beforeDestroy() {
    this.$store.commit('runningTests', false)
  },

  methods: {
    open({ file }) {
      this.$store.commit('runningTests', false)
      this.$store.dispatch('game/load', { file })
    },

    async run(test, idx) {
      if (test.disabled) return
      Vue.set(this.tests, idx, omit(test, ['result']))
      const result = await this.runTest(test.file)
      Vue.set(this.tests, idx, { ...test, result })
    },

    async toggleRunAll() {
      if (!this.isRunningAll) {
        this.isRunningAll = true
        this.stopRunning = false

        for (let idx = 0; idx < this.tests.length; idx++) {
          const test = this.tests[idx]
          if (this.stopRunning) break
          if (test.disabled || test.result) continue
          const result = await this.runTest(test.file)
          Vue.set(this.tests, idx, { ...test, result })
        }

        this.isRunningAll = false
      } else {
        this.stopRunning = true
        this.isRunningAll = false
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
h1
  margin-bottom: 20px

.close
  position: absolute
  top: 10px
  right: 10px

.disabled
  opacity: 0.6

.test-runner-container
  display: flex
  flex-direction: column
  height: 100vh
  overflow: hidden

.test-runner-header
  position: fixed
  top: 0
  left: 0
  right: 0
  height: 70px
  display: flex
  align-items: center
  justify-content: space-between
  padding: 0 20px
  border-bottom: 1px solid #ddd
  z-index: 10

.test-runner-header h1
  margin: 0
  font-size: 20px

.test-runner-header .buttons
  display: flex
  gap: 10px


.test-runner-table
  margin-top: 70px
  flex: 1
  overflow-y: auto

.error-message
  font-size: 0.8em

  +theme using ($theme)
    color: map-get($theme, '--v-error-base')
  
</style>
