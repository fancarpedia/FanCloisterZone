<template>
  <!-- Shown during game setup as soon as something the AI does not play is chosen: AI players
       will not be available for this game (the slot page then offers no "AI player" button). The
       tooltip names what is in the way. -->
  <v-tooltip v-if="!support.ok" bottom max-width="420">
    <template #activator="{ on }">
      <div class="ai-not-available" v-on="on">
        <v-icon small>fa-solid fa-robot</v-icon>
        <v-icon x-small class="slash">fas fa-ban</v-icon>
        <span>{{ $t('game-setup.ai.not-available') }}</span>
      </div>
    </template>
    <div>{{ $t('game-setup.ai.not-supported') }}</div>
    <ul>
      <li v-for="name in blockers" :key="name">{{ name }}</li>
    </ul>
  </v-tooltip>
</template>

<script>
import { mapState } from 'vuex'

import { Expansion } from '@/models/expansions'
import { Rule } from '@/models/rules'
import { aiSupport } from '@/utils/ai-support'

export default {
  computed: {
    ...mapState({
      sets: state => state.gameSetup.sets,
      elements: state => state.gameSetup.elements,
      rules: state => state.gameSetup.rules
    }),

    support () {
      return aiSupport({ sets: this.sets, elements: this.elements, rules: this.rules }, this.$tiles)
    },

    // readable names of what the AI does not play
    blockers () {
      const { expansions, elements, rules } = this.support
      return [
        ...expansions.map(name => {
          const e = Expansion[name]
          const key = 'expansion.' + name.toLowerCase().replace(/_/g, '-')
          return this.$te(key) ? this.$t(key) : (e ? e.title : name)
        }),
        ...elements.map(id => {
          for (const key of ['game.element.' + id, 'game.feature.' + id]) {
            if (this.$te(key)) return this.$t(key)
          }
          return id
        }),
        ...rules.map(id => {
          const r = Rule.all().find(x => x.id === id)
          return (r && r.title) || id
        })
      ]
    }
  }
}
</script>

<style lang="sass" scoped>
.ai-not-available
  display: inline-flex
  align-items: center
  gap: 4px
  margin: 0 8px
  padding: 2px 10px
  border-radius: 12px
  font-size: 13px
  white-space: nowrap
  color: white
  background: #b26a00
  cursor: default

  .v-icon
    color: white

  .slash
    margin-left: -8px
    margin-top: 8px

ul
  margin: 4px 0 0
  padding-left: 18px
</style>
