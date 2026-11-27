<template>
  <!-- A player who left a game with a time limit proposed to play the rest of it turn-based (no time
       limit). Every seated player must accept; one "no" declines it. The proposal lives in the game
       options (server PROPOSE_TURN_BASED / ANSWER_TURN_BASED), so a player who was away answers it
       when they open the game. -->
  <v-snackbar
    :value="shown"
    top
    :timeout="-1"
    class="turn-based-proposal"
  >
    <div class="proposal-body">
      <v-icon class="proposal-icon">fas fa-hourglass-half</v-icon>
      <div class="proposal-text">
        <template v-if="mode === 'ask'">
          <div>{{ $t('game.turn-based.proposal', { name: proposal.name }) }}</div>
          <div class="hint">{{ $t('game.turn-based.all-must-accept') }}</div>
        </template>
        <template v-else-if="mode === 'waiting'">
          <div>{{ mine ? $t('game.turn-based.my-proposal') : $t('game.turn-based.proposal', { name: proposal.name }) }}</div>
          <div class="hint">{{ $t('game.turn-based.waiting', { names: waitingNames }) }}</div>
        </template>
        <template v-else-if="mode === 'declined'">
          {{ $t('game.turn-based.declined', { name: proposal.declinedBy }) }}
        </template>
        <template v-else-if="mode === 'accepted'">
          {{ $t('game.turn-based.accepted') }}
        </template>
      </div>
    </div>
    <template #action="{ attrs }">
      <template v-if="mode === 'ask'">
        <!-- once somebody lost on time the result stands: no switching the timer off any more -->
        <span :title="timedOut ? $t('game.turn-based.lost-on-time-already') : null">
          <v-btn color="success" v-bind="attrs" :disabled="timedOut" @click="answer(true)">
            <v-icon left>fas fa-check</v-icon>{{ $t('game.turn-based.accept') }}
          </v-btn>
        </span>
        <v-btn color="error" text v-bind="attrs" @click="answer(false)">
          <v-icon left>fas fa-times</v-icon>{{ $t('game.turn-based.decline') }}
        </v-btn>
      </template>
      <v-btn v-else icon v-bind="attrs" :title="$t('button.close')" @click="dismissedKey = key">
        <v-icon>fas fa-times</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

export default {
  data () {
    return {
      // the notice closed by the player (it comes back when the proposal changes)
      dismissedKey: null,
      // the proposal was accepted / declined while this game was open
      seenLive: false
    }
  },

  computed: {
    ...mapState({
      slots: state => state.game.slots || [],
      gameId: state => state.game.id,
      me: state => state.settings.clientId,
      timedOut: state => state.game.timedOut !== null && state.game.timedOut !== undefined
    }),
    ...mapGetters({
      proposal: 'game/turnBasedProposal'
    }),

    // a client with a seat votes (an AI seat with its owner)
    voters () {
      return [...new Set(this.slots.filter(s => s.clientId).map(s => s.clientId))]
    },

    amVoter () {
      return !!this.me && this.voters.includes(this.me)
    },

    mine () {
      return !!this.proposal && this.proposal.clientId === this.me
    },

    accepted () {
      return (this.proposal && this.proposal.accepted) || []
    },

    // 'ask' (answer it) | 'waiting' (I accepted, others have not) | 'declined' | 'accepted' | null
    mode () {
      const p = this.proposal
      if (!p || !this.amVoter) return null
      if (p.status === 'open') return this.accepted.includes(this.me) ? 'waiting' : 'ask'
      // the end of a proposal is news for whoever saw it happen; a declined one also for its author
      if (p.status === 'declined' && (this.seenLive || this.mine)) return 'declined'
      if (p.status === 'accepted' && this.seenLive) return 'accepted'
      return null
    },

    waitingNames () {
      const waiting = this.voters.filter(id => !this.accepted.includes(id))
      const names = waiting.map(id => {
        const seat = this.slots.find(s => s.clientId === id && !s.ai) || this.slots.find(s => s.clientId === id)
        return seat?.name || '?'
      })
      return names.join(', ')
    },

    key () {
      const p = this.proposal
      return p ? `${p.status}:${p.clientId}:${this.accepted.length}` : null
    },

    shown () {
      return !!this.mode && (this.mode === 'ask' || this.dismissedKey !== this.key)
    }
  },

  watch: {
    'proposal.status' (value, old) {
      if (old === 'open' && value !== 'open') this.seenLive = true
      if (value === 'open') this.seenLive = false
    }
  },

  methods: {
    answer (accept) {
      if (accept && this.timedOut) return
      this.$connection.send({ type: 'ANSWER_TURN_BASED', payload: { gameId: this.gameId, accept: !!accept } })
    }
  }
}
</script>

<style lang="sass" scoped>
// just below the action panel (which runs along the top), not over it
.turn-based-proposal
  top: calc(var(--action-panel-height, 84px) + 8px)

.turn-based-proposal ::v-deep .v-snack__wrapper
  min-width: 420px
  max-width: calc(100vw - 32px)

.turn-based-proposal ::v-deep .v-snack__action
  gap: 6px

// dark theme: a light notice that stands out on the dark board (as DiscardedTileNotice)
#app.theme--dark .turn-based-proposal ::v-deep .v-snack__wrapper
  background-color: #e0e0e0 !important
  color: #212121 !important

.proposal-body
  display: flex
  align-items: center
  gap: 14px
  font-size: 16px
  line-height: 1.35

.proposal-icon
  font-size: 26px
  color: inherit !important

.hint
  font-size: 13px
  opacity: 0.8
</style>
