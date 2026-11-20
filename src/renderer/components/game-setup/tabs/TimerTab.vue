<template>
  <div>
    <!-- time limits, pre-draw and the cooperative variant side by side (in that order); the
         columns adapt when one is hidden (no timer with AI, no pre-draw in co-op) -->
    <div class="flow-columns">
      <ConfigSection v-if="!ai" :title="$t('game-setup.timer.player-time-limit')">
        <div class="components">
          <!-- like the boxes beside it: off = icon, "Timer", ADD (the whole box adds it); on = the
               two clocks, and the check at the bottom where the other boxes have theirs. Both faces
               are always rendered on top of each other (the hidden one invisible), so the box is as
               tall as the taller one in either state — switching never moves what is below -->
          <div
            class="timer-card"
            :class="{ selected: timer !== null }"
            @click="timer === null && enableLimits()"
          >
            <div class="timer-face" :class="{ hidden: timer === null }">
              <div class="timer-body">
                <!-- short labels fit the box width on one line; the full sentences as tooltips -->
                <div class="timer-label" :title="$t('game-setup.timer.at-game-start-set-timer-to')">{{ $t('game-setup.timer.start-short') }}</div>
                <div class="timer-stepper">
                  <v-btn icon x-small :disabled="initial <= START_MIN" @click="initial = step(initial, -START_STEP, START_MIN)">
                    <v-icon x-small>fas fa-minus</v-icon>
                  </v-btn>
                  <TimeInput key="initial" v-model="initial" />
                  <v-btn icon x-small :disabled="initial >= TIME_MAX" @click="initial = step(initial, START_STEP, START_MIN)">
                    <v-icon x-small>fas fa-plus</v-icon>
                  </v-btn>
                </div>
                <div class="timer-label" :title="$t('game-setup.timer.each-turn-increase-timer-by')">{{ $t('game-setup.timer.turn-short') }}</div>
                <div class="timer-stepper">
                  <v-btn icon x-small :disabled="turn <= 0" @click="turn = step(turn, -TURN_STEP, 0)">
                    <v-icon x-small>fas fa-minus</v-icon>
                  </v-btn>
                  <TimeInput key="turn" v-model="turn" />
                  <v-btn icon x-small :disabled="turn >= TIME_MAX" @click="turn = step(turn, TURN_STEP, 0)">
                    <v-icon x-small>fas fa-plus</v-icon>
                  </v-btn>
                </div>
              </div>
              <div class="timer-toggle" :title="$t('game-setup.timer.disable-limits')" @click.stop="disableLimits">
                <v-icon>fas fa-check</v-icon>
              </div>
            </div>
            <div class="timer-face" :class="{ hidden: timer !== null }">
              <div class="box-title">
                <v-icon class="flow-icon">fa-solid fa-stopwatch</v-icon>
                <h3>{{ $t('game-setup.header.timer') }}</h3>
              </div>
              <div class="timer-toggle add-first">{{ $t('button.add') }}</div>
            </div>
          </div>
        </div>
      </ConfigSection>

      <!-- pre-draw is incompatible with the Keep Building coop variant → hidden entirely there -->
      <ConfigSection v-if="!coopVariant" :title="$t('game-setup.game-flow.pre-draw')">
        <div class="components">
          <!-- Pre-draw: private hand of up to 3 tiles (server-authoritative, online only).
               Disabled in local games, or when an incompatible expansion is selected. -->
          <GameElementBox
            :item="GameElement.PRE_DRAW"
            :max="3"
            :default-value="3"
            :blocked-reason="preDrawReason"
            show-number
          >
            <v-icon class="flow-icon">fa-solid fa-hand</v-icon>
          </GameElementBox>
        </div>
      </ConfigSection>

      <ConfigSection :title="$t('game-setup.game-flow.cooperative')">
        <div class="components">
          <!-- Keep Building: cooperative variant — each turn must enlarge an occupied
               completable feature or occupy a new one, or everyone loses. The same box as
               pre-draw beside it (an on/off element: ADD, then a check) -->
          <GameElementBox :item="GameElement.KEEP_BUILDING">
            <v-icon class="flow-icon">fa-solid fa-handshake</v-icon>
          </GameElementBox>
        </div>
      </ConfigSection>
    </div>

    <ConfigSection :title="$t('game-setup.rules.starting-tiles-configuration')">
      <StartingTiles />
    </ConfigSection>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ConfigSection from '@/components/game-setup/ConfigSection'
import TimeInput from '@/components/game-setup/TimeInput'
import GameElementBox from '@/components/game-setup/GameElementBox'
import StartingTiles from '@/components/game-setup/StartingTiles'
import { GameElement, PRE_DRAW_INCOMPATIBLE } from '@/models/elements'
import { DEFAULT_TIMER } from '@/store/gameSetup'

export default {
  components: {
    ConfigSection,
    TimeInput,
    GameElementBox,
    StartingTiles
  },

  data () {
    return {
      GameElement,
      storedValue: { ...DEFAULT_TIMER },
      // the clocks' − / + steps (seconds): the starting time by 30 s, the per-turn increment by 5 s
      START_STEP: 30,
      TURN_STEP: 5,
      START_MIN: 30,
      TIME_MAX: 99 * 60 + 59 // what the mm:ss clock can show
    }
  },

  computed: {
    ...mapState({
      timer: state => state.gameSetup.timer,
      ai: state => !!state.gameSetup.ai,
      coopVariant: state => !!(state.gameSetup.elements || {})['keep-building']
    }),

    preDrawBlocked () {
      const gs = this.$store.state.gameSetup
      // getFullSetup applies each selected set's `enforces`, so River / Crop Circles (enforced by
      // their tile-sets, not stored directly) are detected alongside directly-set figures.
      const eff = this.$tiles.getFullSetup({ sets: gs.sets || {}, elements: gs.elements || {} }).elements
      // truthy = on (true or count >= 1); NB isConfigValueEnabled(undefined) is true, so don't use it here
      return PRE_DRAW_INCOMPATIBLE.some(k => !!eff[k])
    },

    // Pre-draw needs the server-authoritative model, so it is online-only.
    preDrawLocal () {
      return this.$store.state.networking.connectionType !== 'online'
    },

    // Reason the pre-draw box is locked (local-game first, then incompatible expansions), or null.
    preDrawReason () {
      if (this.preDrawLocal) return this.$t('predraw.local-only')
      if (this.preDrawBlocked) return this.$t('predraw.incompatible')
      return null
    },

    initial: {
      get () {
        return this.timer ? this.timer.initial : this.storedValue.initial
      },

      set (val) {
        this.$store.commit('gameSetup/timer', {
          ...this.timer,
          initial: val
        })
      }
    },

    turn: {
      get () {
        return this.timer ? this.timer.turn : this.storedValue.turn
      },

      set (val) {
        this.$store.commit('gameSetup/timer', {
          ...this.timer,
          turn: val
        })
      }
    }
  },

  methods: {
    // value + delta, kept between min and the clock's maximum (a typed-in value is not snapped)
    step (value, delta, min) {
      const v = (value || 0) + delta
      return Math.max(min, Math.min(this.TIME_MAX, v))
    },

    enableLimits () {
      this.$store.commit('gameSetup/timer', { ...this.storedValue })
    },

    disableLimits () {
      this.storedValue = { ...this.timer }
      this.$store.commit('gameSetup/timer', null)
    }
  }
}
</script>

<style lang="sass" scoped>
// time limits | pre-draw | cooperative in one row; the starting tile configuration below
.flow-columns
  display: grid
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))
  gap: 0 $panel-gap
  align-items: start

.components
  margin-top: $panel-gap
  display: grid
  width: 100%
  justify-content: center
  gap: $panel-gap
  grid-template-columns: repeat(auto-fit, 162px)

  // the game-flow boxes stand in separate columns, so nothing evens their heights out: every
  // name gets room for exactly two lines (e.g. "Keep Building (co-op)"), so the boxes are alike
  ::v-deep .element-box .box-title h3
    line-height: 1.3
    min-height: 2.6em

  // the game-flow boxes' icons: drawn glyphs, sized like the other boxes' 55px images — greyed
  // until the element is on, then in the selected box's text colour
  ::v-deep .flow-icon
    display: flex
    height: 55px
    font-size: 44px !important
    margin: 0 auto

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color') !important

  ::v-deep .selected .flow-icon
    +theme using ($theme)
      color: map-get($theme, 'cards-selected-text') !important

// the time limits card: the look and width of the boxes beside it (cards background, the
// selected colours while on)
.timer-card
  width: 162px
  // both faces in one grid cell: the box takes the taller one's height
  display: grid
  cursor: pointer

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: map-get($theme, 'cards-bg')

  &.selected
    cursor: default

    +theme using ($theme)
      background: map-get($theme, 'cards-selected-bg')
      box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.15), 0 3px 10px 0 rgba(0, 0, 0, 0.10)
      color: map-get($theme, 'cards-selected-text')

  // off: the same title block as GameElementBox (icon, two-line name)
  .box-title
    text-align: center
    min-height: 122px
    padding: 20px 0 4px 0

    h3
      font-size: 1.09em
      font-weight: 300
      margin-top: 14px
      line-height: 1.3
      min-height: 2.6em

.timer-face
  grid-area: 1 / 1
  display: flex
  flex-direction: column

  &.hidden
    visibility: hidden
    pointer-events: none

  // the bottom row sits at the bottom of the (shared) height
  .timer-body, .box-title
    flex: 1

// on: the clocks fill the box above its bottom row
// kept within the height the other boxes have above their bottom row (~138px), so the timer box
// is no taller than they are
// the labels and clocks centred vertically between the box's top and the check ICON: the check
// sits in the middle of its 56px row, ~16px below the row's top, so the top padding is 16px more
// than the bottom one
.timer-body
  flex: 1
  padding: 20px 6px 4px
  display: flex
  flex-direction: column
  justify-content: center

.timer-label
  margin: 4px 0 2px
  font-size: 14px
  line-height: 1.2
  text-align: center

// − clock +, centred in the card
.timer-stepper
  display: flex
  align-items: center
  justify-content: center
  gap: 2px

  .v-btn
    color: inherit !important

// the clocks smaller than the free-standing ones they replace
.timer-card ::v-deep .time-input
  font-size: 24px
  line-height: 1.15
  padding: 2px 4px

  input
    width: 30px
    height: 28px
    margin: 0 2px
    line-height: 28px

// the bottom row — the check (on) or ADD (off) — as tall and placed as QuantityButtons' controls
.timer-toggle
  height: 56px
  display: flex
  align-items: center
  justify-content: center
  cursor: pointer

  .v-icon
    font-size: 24px
    color: inherit !important

  &.add-first
    font-size: 16px
    text-transform: uppercase
    font-weight: 300

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  &.add-first:hover
    text-decoration: underline
</style>
