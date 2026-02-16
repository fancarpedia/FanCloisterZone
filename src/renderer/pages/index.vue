<template>
  <div class="landing-view view">
    <div>
      <v-alert v-if="java && java.error === 'not-found' && !javaSelectedByUser" type="warning">
        {{ $t('settings.java.unable-to-find-java') }}<br>
        <br>
        {{ $t('settings.java.java-is-required') }}<br>
        <a href="#" @click="openLink('https://www.oracle.com/java/technologies/javase-jdk14-downloads.html')">{{ $t('settings.java.download-java') }}</a><br>
        <i18n tag="span" path="settings.java.verify">
          <template #settings>
            <a href @click.prevent="() => $store.commit('showSettings', true)">{{ $t('settings.title') }}</a>
          </template>
        </i18n>
      </v-alert>
      <v-alert v-if="java && java.error === 'not-found' && javaSelectedByUser" type="warning">
        {{ $t('settings.java.java-path-is-not-valid') }}<br>
        <br>
        <i18n tag="span" path="settings.java.change-in-settings">
          <template #settings>
            <a href @click.prevent="() => $store.commit('showSettings', true)">{{ $t('settings.title') }}</a>
          </template>
        </i18n>
      </v-alert>
      <v-alert v-if="java && java.error === 'outdated'" type="warning">
        {{ $t('settings.java.java-is-outdated') }}<br>
        <br>
        {{ $t('settings.java.java-version-found', { version: java.version } ) }}
        <br>
        <a href="#" @click="openLink('https://www.oracle.com/java/technologies/javase-jdk14-downloads.html')">{{ $t('settings.java.download-java') }}</a><br>
        <i18n tag="span" path="settings.java.select-manually">
          <template #settings>
            <a href @click.prevent="() => $store.commit('showSettings', true)">{{ $t('settings.title') }}</a>
          </template>
        </i18n>
      </v-alert>
      <v-alert v-if="engine && engine.error === 'not-found'" type="warning">
        <i18n tag="span" path="settings.engine.engine-path-not-exists">
          <template #path>
            <i>{{ engine.path }}</i>
          </template>
        </i18n>
      </v-alert>
      <v-alert v-if="engine && engine.error === 'exec-error'" type="warning">
        {{ $t('settings.engine.unable-to-spawn-game-engine') }}<br>
        <small>{{ engine.errorMessage }}</small>
      </v-alert>
      <v-alert v-if="artworksLoaded && !hasClassicAddon" type="warning">
        {{ $t('settings.add-ons.artwork-not-found-internet-connection-is-needed') }}<br>
        {{ $t('settings.add-ons.please-check-connectivity-and-restart-app') }}<br>
        <small>{{ $t('settings.add-ons.add-on-url') }}: <a :href="$addons.getDefaultArtworkUrl()" @click.prevent="openLink($addons.getDefaultArtworkUrl())">>{{ $addons.getDefaultArtworkUrl() }}</a></small>
      </v-alert>
      <div v-if="download" class="download">
        <v-progress-linear
          v-if="download.size"
          :value="download.size ? download.progress / download.size * 100 : null"
        />
        <v-progress-linear v-else indeterminate />
      </div>
      <div v-if="updateInfo" class="update-box">
        <InstallerDownloader
          :fileURL="isWin ? updateInfo.assetUrl.exe : isMac ? updateInfo.assetUrl.dmg : updateInfo.assetUrl.appImage"
          :titleText="$t('index.update.new-version-available')"
          :downloadButtonText="$t('index.update.download')"
          :installButtonText="$t('index.update.install-new-version')"
          :installerErrorText="$t('index.update.download-error')"
          :startingText="$t('index.update.starting')"
        />

        <h4>{{ $t('index.update.release-notes') }}</h4>
        <div class="update-release-notes">
          <div v-html="updateInfo.releaseNotes" />
        </div>
      </div>
    </div>

    <section class="splash">
      <img :src="splashImage()" />
    </section>

    <section class="online-hosted-fan">
      <div>
        <h2>{{ $t('index.online.title-fan') }}</h2>
        <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="playOnlineFan()">
          {{ $t('button.play-online-fan') }}
          <v-icon right>fa-cloud</v-icon>
        </v-btn>
        <!-- <div class="subsection">
          {{ $t('index.online.some-expansions-are-playable-only-here') }}
          <br />
          {{ $t('expansion.meteorites') }}
          <br />
          {{ $t('index.online.chat-during-game') }}
        </div> -->
      </div>
    </section>

    <!-- <section class="online-hosted">
      <div>
        <h2>{{ $t('index.online.title') }}</h2>
        <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="playOnline()">
          {{ $t('button.play-online') }}
          <v-icon right>fa-cloud</v-icon>
        </v-btn>
        <div class="subsection">
          {{ $t('index.online.private-games-only') }}<br>({{ $t('index.online.no-random-discovery') }})
        </div>
      </div>
    </section> -->

    <section class="player-hosted">
      <h2>{{ $t('index.local.local-games') }}</h2>

      <div class="subsection">
        <v-btn large color="secondary" @click="newGame()">
          {{ $t('index.local.new-game') }}
        </v-btn>

        <v-btn v-if="settings.devMode === true" large color="secondary" @click="newGameAI()">
          {{ $t('index.local.new-game-against-ai') }}
        </v-btn>

        <!-- <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="joinGame()">
          {{ $t('button.join-game') }}
        </v-btn> -->

        <v-btn large color="secondary" :disabled="!engine || !engine.ok" @click="loadGame()">
          {{ $t('index.local.open-game') }}
        </v-btn>
      </div>

      <div class="subsection">
        {{ $t('index.local.create-directly-from') }} <a class="my-list" @click="newGame(0)"><v-icon>far fa-heart</v-icon> {{ $t('index.local.my-favorites') }}</a>
      </div>

      <div v-if="recentSaves.length" class="subsection">
        {{ $t('index.local.continue-with-recently-saved-games') }}

        <div class="recent-list">
          <a v-for="save in recentSaves" :key="save" href="#" @click="loadSavedGame(save)">{{ save }}</a>
          <a class="clear" href="#" @click="clearRecentSaves"><v-icon>fas fa-times</v-icon> {{ $t('button.clear-list') }}</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { shell, ipcRenderer } from 'electron'

import Vue from 'vue'
import { mapState } from 'vuex'

import AddonsReloadObserverMixin from '@/components/AddonsReloadObserverMixin'
import InstallerDownloader from '@/components/InstallerDownloader'

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

import { STATUS_CONNECTED } from '@/store/networking'

export default {
  components: {
    InstallerDownloader
  },

  mixins: [
    AddonsReloadObserverMixin
  ],

  data () {
    return {
      isMac,
      isWin,
      // do not bind it to store
      recentSaves: [...this.$store.state.settings.recentSaves],
      updating: false,
      showRecentSetupMenu: false,
      menuX: null,
      menuY: null,
      menuItemIdx: null
    }
  },

  computed: {
    ...mapState({
      javaSelectedByUser: state => state.settings.javaPath,
      java: state => state.java,
      engine: state => state.engine,
      download: state => state.download,
      settings: state => state.settings,
      settingsLoaded: state => state.loaded.settings,
      artworksLoaded: state => state.loaded.artworks,
      hasClassicAddon: state => state.hasClassicAddon,
      connectionStatus: state => state.networking.connectionStatus,
      updateInfo: state => state.updateInfo
    }),

    connectionStatus() {
      return this.connectionStatus
    }
  },

/*  created() {
    if (this.connectionStatus === null) {
      this.$store.dispatch('networking/connectPlayOnlineFan')
    } else if (this.connectionStatus === STATUS_CONNECTED) {
      // not reconnecting
      this.$connection.send({ type: 'LIST_GAMES', payload: {} })
      this.$connection.send({ type: 'LIST_PUBLIC_GAMES', payload: {} })
    }
  },*/
  watch: {
/*    connectionStatus(newValue) {
      if (newValue === null) {
        this.$store.dispatch('networking/connectPlayOnlineFan')
      } else if (newValue === STATUS_CONNECTED) {
        this.$connection.send({ type: 'LIST_GAMES', payload: {} })
        this.$connection.send({ type: 'LIST_PUBLIC_GAMES', payload: {} })
      }
    },*/
    settingsLoaded () {
      this.recentSaves = [...this.$store.state.settings.recentSaves]
    }
  },

  methods: {
    newGame (tab) {
      this.$store.dispatch('gameSetup/newGame')
      this.$router.push('/game-setup' + (tab !== undefined ? `?tab=${tab}` : ''))
    },

    newGameAI (tab) {
      this.$store.dispatch('gameSetup/newGameAI')
      this.$router.push('/game-setup' + (tab !== undefined ? `?tab=${tab}` : ''))
    },

    joinGame () {
      this.$store.commit('showJoinDialog', true)
    },

    playOnline () {
      this.$store.dispatch('networking/connectPlayOnline')
    },

    playOnlineFan () {
      this.$store.dispatch('networking/connectPlayOnlineFan')
    },

    loadGame () {
      this.$store.dispatch('game/load')
    },

    async loadSavedGame (file) {
      try {
        await this.$store.dispatch('game/load', { file })
      } catch {
        await this.$store.dispatch('settings/validateRecentSaves')
        this.recentSaves = [...this.$store.state.settings.recentSaves]
      }
    },

    loadSetup (setup) {
      this.$store.dispatch('gameSetup/load', setup)
      this.$router.push('/game-setup')
    },

    openLink (href) {
      shell.openExternal(href)
    },

    clearRecentSaves () {
      this.$store.dispatch('settings/clearRecentSaves')
      this.recentSaves = []
    },

    splashImage () {
      const theme = this.$vuetify.theme.dark ? 'dark' : 'light'
      return require(`@/assets/splash_${theme}.png`)
    },

    afterAddonsReloaded () {
      // DEL ?
    },

    showRecentSetup (e, idx) {
      e.preventDefault()
      this.showRecentSetupMenu = false
      this.menuX = e.clientX
      this.menuY = e.clientY
      this.menuItemIdx = idx
      Vue.nextTick(() => {
        this.showRecentSetupMenu = true
      })
    }
  }
}
</script>

<style lang="sass" scoped>
*
  user-select: none

.landing-view
  position: relative
  display: flex
  flex-direction: column

h2
  font-weight: 300
  font-size: 26px
  margin: 0 0 20px

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.v-alert
  margin-bottom: 0

.subsection
  font-weight: 300
  font-size: 16px
  margin-top: 30px

  .v-btn
    margin: 0 20px

.my-list
  display: inline-block
  margin-top: 10px
  font-size: 16px

  &:hover
    text-decoration: underline

  i
    color: inherit !important
    font-size: inherit !important

.online-hosted, .online-hosted-fan
  height: 33vh
  display: flex
  justify-content: center
  align-items: center

  +theme using ($theme)
    background: map-get($theme, 'board-bg')

  > div
    text-align: center

    .v-btn i
      margin-left: 20px

  p
    margin-top: 30px

.online-hosted-fan
  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')


.player-hosted
  padding: 30px 0
  text-align: center

  h2
    margin-bottom: 40px

  .player-hosted-content
    display: flex
    justify-content: center
    align-items: stretch

    > div
      flex: 1

.recent-list
  margin-top: 4px
  display: flex
  flex-direction: column
  align-items: center

  a
    +theme using ($theme)
      &:hover
        color: map-get($theme, 'text-color')

    &.clear
      font-size: 14px
      margin-top: 10px

      i
        color: inherit !important
        font-size: inherit !important

.update-box
  padding: 20px
  color: black
  text-align: center

  +theme using ($theme)
    background-color: map-get($theme, 'update-box-backgrouncolor')

  .update-action
    margin: 20px 0

  .update-note
    font-style: italic
    margin-bottom: 10px
    
  .update-release-notes
    max-height: 25vh
    overflow: auto
    text-align: left
    
    &::-webkit-scrollbar
      width: 8px
      height: 8px

    &::-webkit-scrollbar-track
      background: #f0f0f0
      border-radius: 10px

    &::-webkit-scrollbar-thumb
      background: linear-gradient(180deg, #4e9af1, #0056b3)
      border-radius: 10px

      &:hover
        background: linear-gradient(180deg, #66b2ff, #007bff)
  
  ::v-deep ul
    list-style: none

  ::v-deep a
    color: white

.download
  padding: 0 20px

.download-header
  display: flex

  .description
    flex-grow: 1

.splash
  height: 25vh
  display: flex
  justify-content: center
  align-items: center
  
  img
    max-width: 600px

@media (max-height: 1199px)
  .landing-view
    .disclaimer-box
      margin-top: 20px
      margin-bottom: 20px

@media (max-height: 768px)
  .player-hosted
    padding-top: 0

  .landing-view .disclaimer-content p
    margin-bottom: 8px
</style>
