<template>
  <div class="game-setup-overview" :class="{ compact }">
    <!-- game type: standard vs Keep Building (co-op) — same badge as the inline overview,
         plus a "custom pack" marker when tile counts were edited -->
    <div class="game-type-wrap">
      <div class="game-type" :class="{ coop: isCoop }">
        {{ isCoop ? $t('game.feature.keep-building') : $t('game-setup.variant.standard') }}
      </div>
      <div v-if="tilesChanged" class="game-type tiles-changed" :class="hl('tiles')" :title="$t('game-setup.tiles.custom-pack')">
        ✂ {{ $t('game-setup.tiles.custom-pack-short') }}
      </div>
      <!-- favourite this setup: a heart beside the game type (filled = already a favourite) -->
      <v-btn
        icon
        x-small
        class="favorite-btn"
        :class="{ active: isFavorite }"
        :title="isFavorite ? $t('button.remove-from-favorites') : $t('button.add-to-favorites')"
        @click="isFavorite ? removeFromMySetups() : addToMySetups()"
      >
        <v-icon small>{{ isFavorite ? 'fas fa-heart' : 'far fa-heart' }}</v-icon>
      </v-btn>
    </div>
    <!-- compact: tile sets and elements in one row, as in the lobby -->
    <div class="tiles-row">
      <div class="label" :class="hl('sets', 'tiles')">
        <h3>{{ $t('game-setup.selected-tiles') }}</h3>
      </div>
      <section :class="hl('sets', 'tiles')">
        <OverviewExpansionTile
          v-for="{ expansion, id, title, quantity, lang } in releases"
          :key="id"
          :expansion="expansion"
          :title="title"
          :quantity="quantity"
          :lang="lang"
          :class="compact ? hl('sets', 'tiles') : null"
        />
      </section>
      <div v-if="additions.length" class="label" :class="hl('elements')">
        <h3>{{ $t('game-setup.additional-elements') }}</h3>
      </div>
      <section :class="hl('elements')">
        <OverviewElementTile
          v-for="([element, value]) in additions"
          :key="element"
          :element="element"
          :value="value"
          :class="compact ? hl('elements') : null"
        />
      </section>
      <div v-if="removals.length" class="label" :class="hl('elements')">
        <h3>{{ $t('game-setup.removed-elements') }}</h3>
      </div>
      <section :class="hl('elements')">
        <OverviewElementTile
          v-for="([element, value]) in removals"
          :key="element"
          :element="element"
          :value="value"
          :class="compact ? hl('elements') : null"
        />
      </section>
    </div>
    <div v-if="timer" class="label" :class="hl('timer')">
      <h3>{{ $t('game-setup.header.timer') }}</h3>
    </div>
    <section v-if="timer" class="timer" :class="hl('timer')">
      <v-icon v-if="compact" class="timer-icon">far fa-clock</v-icon>
      <TimerValue :value="timer.initial" />
      <template v-if="timer.turn">
        &emsp;+&thinsp;<TimerValue :value="timer.turn" />
      </template>
    </section>

    <div v-if="gameplayAltred" class="rules" :class="hl('rules')">
      <div class="label">
        <h3>{{ $t('game-setup.altered-gameplay') }}</h3>
      </div>
      <GameplayVariants :setup="setup" show="changed" read-only />
    </div>

    <div v-if="scoringAltred" class="rules" :class="hl('rules')">
      <div class="label">
        <h3>{{ $t('game-setup.altered-scoring') }}</h3>
      </div>
      <ScoringVariants :setup="setup" show="changed" read-only />
    </div>

  </div>
</template>

<script>
import { GAMEPLAY, SCORING, Rule } from '@/models/rules'

import GameSetupOverviewMixin from '@/components/game-setup/overview/GameSetupOverviewMixin'
import GameplayVariants from '@/components/game-setup/rules/GameplayVariants'
import OverviewElementTile from '@/components/game-setup/overview/OverviewElementTile'
import OverviewExpansionTile from '@/components/game-setup/overview/OverviewExpansionTile'
import ScoringVariants from '@/components/game-setup/rules/ScoringVariants'
import TimerValue from '@/components/game-setup/overview/TimerValue'

export default {
  components: {
    GameplayVariants,
    OverviewElementTile,
    OverviewExpansionTile,
    ScoringVariants,
    TimerValue
  },

  mixins: [GameSetupOverviewMixin],

  props: {
    setup: { type: Object, required: true },
    // what the owner just changed (setup categories: sets, tiles, elements, rules, timer, start) —
    // those parts are highlighted for a moment
    changed: { type: Array, default: () => [] },
    // smaller tiles and no section headers (the aside of the take-slot page)
    compact: { type: Boolean, default: false }
  },

  computed: {
    // this setup is one of my favourites (bookmarks)
    isFavorite () {
      return this.$store.getters['settings/isMySetup'](this.setup)
    },
    sets () { return this.setup?.sets },
    rules () { return this.setup?.rules },
    elements () { return this.setup?.elements },
    timer () { return this.setup?.timer },

    tilesChanged () {
      return !!(this.setup?.tileOverrides && Object.keys(this.setup.tileOverrides).length)
    },

    isCoop () {
      return !!this.elements?.['keep-building']
    },

    gameplayAltred () {
      return Rule.all().filter(r => r.kind === GAMEPLAY).some(r => this.rules[r.id] !== undefined && r.default !== this.rules[r.id])
    },

    scoringAltred () {
      return Rule.all().filter(r => r.kind === SCORING).some(r => this.rules[r.id] !== undefined && r.default !== this.rules[r.id])
    }
  },

  methods: {
    // the highlight class of a part, when one of its categories just changed
    hl (...categories) {
      return { 'just-changed': categories.some(c => this.changed.includes(c)) }
    },

    addToMySetups () {
      this.$store.dispatch('settings/addMySetup', this.setup)
    },

    removeFromMySetups () {
      this.$store.dispatch('settings/removeMySetup', this.setup)
    }
  }
}
</script>

<style lang="sass" scoped>
// the owner just changed this part of the setup: a highlight that fades out
@keyframes just-changed
  0%, 30%
    background-color: rgba(255, 193, 7, 0.55)
  100%
    background-color: rgba(255, 193, 7, 0)

.just-changed
  border-radius: 4px
  animation: just-changed 8s ease-out forwards

.game-type-wrap
  text-align: center
  margin-top: 10px
  display: flex
  justify-content: center
  gap: 6px

  .game-type
    display: inline-block
    padding: 2px 12px
    border-radius: 10px
    font-size: 13px
    font-weight: 600
    text-transform: uppercase
    letter-spacing: 0.5px
    color: white
    background: #9e9e9e

    &.coop
      background: #009900

    &.tiles-changed
      background: #7B1FA2 // purple — custom tile pack

section
  display: flex
  flex-wrap: wrap
  padding: 0 20px

  .element-box
    width: 80px
    height: 105px
    margin: 1.5px

    +theme using ($theme)
      background-color: map-get($theme, 'overview-tile-bg')

    &.off
      +theme using ($theme)
        background: map-get($theme, 'overview-tile-off-bg')

    ::v-deep .symbol
      height: 80px

  &.timer
    display: block
    text-align: center
    font-size: 26px
    font-weight: 300

.label
  text-align: center
  padding: 20px 0 10px 0

  h2, h3
    font-weight: 300
    font-size: 16px
    text-transform: uppercase

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

// the favourite heart beside the game type badge
.favorite-btn
  align-self: center

  &.active .v-icon
    color: #e53935


// compact (the take-slot page's aside): no section headers, the tiles at about the lobby's size
.game-setup-overview.compact
  .label
    display: none

  section
    padding: 0 8px
    justify-content: center

  .tiles-row
    display: flex
    flex-wrap: wrap
    justify-content: center
    padding: 4px 8px 0

    section
      display: contents

    ::v-deep .element-box
      zoom: 0.6

  .rules
    margin-top: 8px
    zoom: 0.75

  section.timer
    margin-top: 8px
    font-size: 20px

    .timer-icon
      font-size: 18px
      margin-right: 6px
      vertical-align: baseline
</style>
