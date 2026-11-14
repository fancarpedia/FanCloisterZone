<template>
  <!-- Who is watching this online game: connected to it without a seat (server GAME_OBSERVERS).
       Shown under the player panels only while somebody is. -->
  <section v-if="observers.length" class="observers-panel">
    <div class="observers-title">
      <v-icon small>fas fa-eye</v-icon>
      {{ $t('game.observers.watching') }}
    </div>
    <div
      v-for="o in observers"
      :key="o.clientId"
      class="observer"
      :class="{ me: o.clientId === myClientId }"
    >
      <CountryFlag :country="o.country" />
      <span class="observer-name">{{ o.name || '—' }}</span>
    </div>
  </section>
</template>

<script>
import { mapState } from 'vuex'

import CountryFlag from '@/components/CountryFlag'

export default {
  components: { CountryFlag },

  computed: mapState({
    observers: state => state.game.observers || [],
    myClientId: state => state.settings.clientId
  })
}
</script>

<style lang="sass" scoped>
.observers-panel
  pointer-events: auto
  margin-top: 6px
  padding: 6px 10px
  border-radius: 6px
  font-size: 13px

  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')
    color: map-get($theme, 'text-color')

.observers-title
  display: flex
  align-items: center
  gap: 6px
  font-size: 12px
  font-weight: 500
  text-transform: uppercase
  opacity: 0.75
  margin-bottom: 2px

.observer
  display: flex
  align-items: center
  gap: 6px
  min-width: 0

  &.me .observer-name
    font-weight: 600

.observer-name
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
</style>
