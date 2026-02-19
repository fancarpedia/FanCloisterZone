<template>
  <v-card class="about">
    <v-card-text>
      <section class="d-flex justify-center py-10 splash">
        <img :src="splashImage()" :title="$t('about.fantitle')" />
      </section>
      <section class="d-flex justify-space-between">
        <div><span class="label">{{ $t('about.author') }}</span>: Roman Krejčík &amp; fans</div>
        <div>
          <span class="label"><template v-if="$i18n.locale == 'en'">{{ $t('about.corrections') }}</template><template v-else>
              {{ $t('about.translation') }} ({{ $i18n.locale }})</template></span>:
          {{ $t('@author') }}
        </div>
      </section>
      <hr class="my-3">
      <section class="my-3">
        <div class="label">{{ $t('about.configuration-file') }}</div>
        <div class="value config-file" @click="openConfig">{{ $store.state.settings.file }}</div>
        <div class="label">{{ $t('about.system-java-version') }}</div>
        <div class="value">{{ java ? (java.version || '') : '' }}</div>
        <div class="label">{{ $t('about.jcloisterzone-game-engine') }}</div>
        <div class="value">{{ engine ? engine.path : '' }}</div>
        <div class="value">{{ engine ? engine.version : '' }}</div>
      </section>
      <hr class="my-3">
      <section class="d-flex justify-space-between align-center">
        <div><span class="label">{{ $t('about.version') }}:</span> {{ version }}</div>
        <div class="report-bug" @click="openReportBug"><span class="label">{{ $t('menu.report-bug')}}</span>: <v-icon class="color-overlay">fab fa-discord</v-icon></div>
        <v-btn text @click="$emit('close')">{{ $t('button.close') }}</v-btn>
      </section>
    </v-card-text>
  </v-card>
</template>

<script>
import { shell } from 'electron'
import { mapState } from 'vuex'

import { getAppVersion } from '@/utils/version'

const MEEPLES_SVG = require('~/assets/meeples.svg')

export default {
  data () {
    return {
      MEEPLES_SVG,
      version: getAppVersion()
    }
  },

  computed: mapState({
    java: state => state.java,
    engine: state => state.engine
  }),

  methods: {
    openConfig () {
      shell.openPath(this.$store.state.settings.file)
    },
    openReportBug () {
      shell.openPath('https://discord.gg/CswNeVg3eS') /* Fan Edition */
    },
    splashImage () {
      const theme = this.$vuetify.theme.dark ? 'dark' : 'light'
      return require(`@/assets/splash_${theme}.png`)
    }
  }
}

</script>

<style lang="sass" scoped>
.about
  .splash
    img
      max-width: 75%
    
  section
    font-size: 16px

  .version
    font-weight: 500
    font-size: 20px
    margin-bottom: 10px

  .label
    margin-top: 5px
    font-weight: bolder

  .value
    margin-left: 20px

  .config-file, .report-bug
    cursor: pointer

    &:hover
      text-decoration: underline
</style>
