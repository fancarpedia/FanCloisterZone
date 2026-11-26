<template>
  <!-- An online game ended by a resignation (server state FX): who resigned and who won, instead of
       the actions (no move can be made any more). Close leaves the game. -->
  <section class="resignation-panel">
    <v-icon class="flag">fas fa-flag</v-icon>
    <div class="who">
      <div
        v-for="seat in knownSeats"
        :key="'r' + seat"
        :class="colorCssClass(seat)"
      >
        <Meeple type="SmallFollower" :ai="isAi(seat)" />
      </div>
    </div>
    <div class="text">
      <template v-if="resignation.mine">{{ $t('game.resign.you-resigned') }}</template>
      <template v-else>{{ $t('game.resign.player-resigned', { name: resignation.name }) }}</template>
    </div>
    <template v-if="winners.length">
      <div class="num">🥇</div>
      <div
        v-for="w in winners"
        :key="'w' + w.seat"
        :class="colorCssClass(w.seat)"
      >
        <Meeple type="SmallFollower" :ai="isAi(w.seat)" />
      </div>
      <div class="text winner-text">
        <template v-if="iWon">{{ $t('game.resign.you-win') }}</template>
        <template v-else>{{ $t('game.resign.winner', { name: winners.map(w => w.name).join(', ') }) }}</template>
      </div>
    </template>
    <div class="pass-item">
      <v-btn :large="$vuetify.breakpoint.height > 768" color="secondary" @click="close">
        <v-icon left>fa-times</v-icon>
        {{ $t('button.close') }}
      </v-btn>
    </div>
  </section>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { ipcRenderer } from 'electron'

import Meeple from '@/components/game/Meeple'

export default {
  components: { Meeple },

  computed: {
    ...mapState({
      resignation: state => state.game.resignation,
      players: state => state.game.players || [],
      mySession: state => state.networking.sessionId
    }),
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    // only seats of players this game has (a colour lookup of a missing player would throw)
    knownSeats () {
      return (this.resignation.seats || []).filter(seat => this.players[seat])
    },

    // the player(s) in first place of the result the server stored with the resignation
    winners () {
      return (this.resignation.results || []).filter(r => r.position === 1 && !r.resigned && this.players[r.seat])
    },

    // one of this client's seats is among the winners
    iWon () {
      return this.winners.some(w => this.players[w.seat]?.sessionId === this.mySession)
    }
  },

  methods: {
    isAi (seat) {
      return !!this.players[seat]?.ai
    },

    // leave the finished game (online: no confirmation — it is over). The result has been seen:
    // the game leaves this player's lobby list (DISMISS_RESIGNED).
    close () {
      const gameId = this.$store.state.game.id
      if (gameId && this.$connection) {
        this.$connection.send({ type: 'DISMISS_RESIGNED', payload: { gameId } })
      }
      ipcRenderer.emit('menu.leave-game')
    }
  }
}
</script>

<style lang="sass" scoped>
.resignation-panel
  flex: 1
  display: flex
  justify-content: center
  align-items: center
  gap: 10px

  .flag
    font-size: 26px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  .who
    display: flex

  .num
    font-size: 28px
    margin-left: 18px

  .text
    font-size: $action-text-size
    font-weight: 300

  .winner-text
    font-weight: 500

  svg.meeple
    width: 36px
    height: 36px
</style>
