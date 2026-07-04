<template>
  <div>
    <ConfigSection :title="$t('game-setup.rules.starting-tiles-configuration')">
      <StartingTiles />
    </ConfigSection>

    <ConfigSection :title="$t('game-setup.game-flow.pre-draw')">
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
          <div class="predraw-icon">⤵<span>hand</span></div>
        </GameElementBox>
      </div>
    </ConfigSection>

    <ConfigSection v-if="!ai" :title="$t('game-setup.timer.player-time-limit')">
      <template v-if="timer !== null">
        <!-- TODO use display grid -->
        <div class="limits-row">
          <span class="label">{{ $t('game-setup.timer.at-game-start-set-timer-to') }}</span>
          <div class="clock">
            <TimeInput v-model="initial" />
          </div>
        </div>
        <div class="limits-row">
          <span class="label">{{ $t('game-setup.timer.each-turn-increase-timer-by') }}</span>
          <div class="clock">
            <TimeInput v-model="turn" />
          </div>
        </div>
        <!-- <div class="limits-row">
          <span class="label">{{ $t('game-setup.timer.when-time-is-over') }}</span>
          <span>{{ $t('game-setup.timer.do-nothing') }}</span>
        </div> -->
        <div class="buttons">
          <v-btn color="secondary" @click="disableLimits">{{ $t('game-setup.timer.disable-limits') }}</v-btn>
        </div>
      </template>
      <template v-else>
        <div class="unlimited">
          {{ $t('game-setup.timer.unlimited-time') }}
        </div>
        <div class="buttons">
          <v-btn color="secondary" @click="enableLimits">{{ $t('game-setup.timer.enable-limits') }}</v-btn>
        </div>
      </template>
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
      storedValue: {
        initial: 3 * 60,
        turn: 20
      }
    }
  },

  computed: {
    ...mapState({
      timer: state => state.gameSetup.timer,
      ai: state => !!state.gameSetup.ai
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
        return this.timer ? this.timer.initial : null
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
        return this.timer ? this.timer.turn : null
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
.components
  margin-top: $panel-gap
  display: grid
  width: 100%
  justify-content: center
  gap: $panel-gap
  grid-template-columns: repeat(auto-fill, 162px)

  ::v-deep .predraw-icon
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    width: 55px
    height: 55px
    font-size: 22px
    margin: 0 auto

    span
      font-size: 10px

.unlimited
  margin-top: 40px
  text-align: center
  font-size: 36px
  font-weight: 300

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.buttons
  margin-top: 40px
  text-align: center

.limits-row
  margin-top: 40px
  display: flex
  justify-content: center
  align-items: center

  .label
    width: 220px
    text-align: right

.clock
  margin: 0 40px
</style>
