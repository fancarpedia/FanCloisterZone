<template>
  <div class="engine-alerts">
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
      <small>{{ $t('settings.add-ons.add-on-url') }}: <a :href="$addons.getDefaultArtworkUrl()" @click.prevent="openLink($addons.getDefaultArtworkUrl())">{{ $addons.getDefaultArtworkUrl() }}</a></small>
    </v-alert>
  </div>
</template>

<script>
import { shell } from 'electron'
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState({
      engine: state => state.engine,
      artworksLoaded: state => state.loaded.artworks,
      hasClassicAddon: state => state.hasClassicAddon
    })
  },

  methods: {
    openLink (href) {
      shell.openExternal(href)
    }
  }
}
</script>

<style lang="sass" scoped>
.engine-alerts
  .v-alert
    margin-bottom: 0
</style>
