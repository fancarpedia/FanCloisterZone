<template>
  <v-card class="about">
    <v-card-text>
      <section class="d-flex justify-center align-center py-10 splash">
        <img :src="splashImage()" :title="$t('about.fantitle')" />
        <!-- alpha builds carry the same α badge as the lobby splash -->
        <div v-if="isAlpha" class="alpha-badge" :title="version">
          <span class="alpha-symbol">α</span> Alpha
        </div>
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

import { getAppVersion, isAlphaBuild } from '@/utils/version'

const MEEPLES_SVG = require('~/assets/meeples.svg')

export default {
  data () {
    return {
      MEEPLES_SVG,
      version: getAppVersion(),
      isAlpha: isAlphaBuild()
    }
  },

  computed: mapState({
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

    .alpha-badge
      display: flex
      align-items: center
      gap: 5px
      margin-left: 20px
      padding: 4px 12px
      border-radius: 8px
      font-size: 18px
      font-weight: 600
      letter-spacing: 1px
      text-transform: uppercase
      color: white
      background: #E65100
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3)

      .alpha-symbol
        font-size: 28px
        font-weight: 700
        line-height: 1
        text-transform: none // keep the lowercase greek α
    
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
