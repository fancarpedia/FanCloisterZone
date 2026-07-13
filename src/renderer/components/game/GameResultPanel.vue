<template>
  <section>
    <div class="standing">
      <!-- coop (Keep Building): no single winner — the whole team wins or loses together -->
      <div v-if="coop" class="rank">
        <div class="num">{{ coop.lost ? '💔' : '🏆' }}</div>
        <div
          v-for="(p, index) in allPlayers"
          :key="index"
          :class="colorCssClass(index)"
        >
          <Meeple type="SmallFollower" />
        </div>
        <div class="coop-result">
          {{ coop.lost ? $t('game.coop.all-lose') : $t('game.coop.team-score', { points: teamPoints }) }}
        </div>
      </div>
      <template v-else>
        <div
          v-for="r in ranks"
          :key="r.rank"
          class="rank"
        >
          <template v-if="r.rank == 1">
            <div class="num">🥇</div>
            <div
              v-for="p in r.players"
              :key="p.index"
              :class="colorCssClass(p.index)"
            >
              <Meeple type="SmallFollower" />
            </div>
          </template>
        </div>
      </template>
    </div>

    <div class="buttons">
      <v-btn large color="secondary" @click="toggleStats" class="toggle-stats">
        <v-icon left>fa-chart-bar</v-icon>
        {{ showGameStats ? $t('button.hide-stats') : $t('button.show-stats') }}
      </v-btn>

      <v-btn large color="secondary" @click="playAgain" class="play-again">
        <v-icon left>fas fa-play</v-icon>
        {{ $t('button.play-again') }}
      </v-btn>

      <v-btn v-if="rematchAvailable" large color="primary" @click="rematch" class="rematch">
        <v-icon left>fas fa-arrows-rotate</v-icon>
        {{ $t('button.rematch') }}
      </v-btn>

      <v-btn large color="error" @click="close" class="close">
        <v-icon left>fa-times</v-icon>
        {{ $t('button.close') }}
      </v-btn>
    </div>
  </section>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import Meeple from '@/components/game/Meeple'
import { reverseSeatOrder } from '@/store/rematch'

export default {
  components: {
    Meeple
  },

  computed: {
    ...mapState({
      gameKey: state => state.game.key,
      showGameStats: state => state.game.showGameStats,
      onlineConnected: state => state.networking.connectionType === 'online',
      coop: state => state.game.coop,
      allPlayers: state => state.game.players
    }),

    ...mapGetters({
      colorCssClass: 'game/colorCssClass',
      ranks: 'game/ranks'
    }),

    // Keep Building (coop): one shared team score
    teamPoints () {
      return (this.allPlayers || []).reduce((acc, p) => acc + p.points, 0)
    },

    // Rematch swaps/reshuffles the seating: always possible for local games; for online games
    // only when every occupied seat belongs to THIS client (hotseat) — remote players can't be
    // re-seated automatically.
    rematchAvailable () {
      if (!this.gameKey) return true
      const { slots } = this.$store.state.game
      const clientId = this.$store.state.settings.clientId
      const occupied = (slots || []).filter(s => s.clientId)
      return occupied.length > 0 && occupied.every(s => s.clientId === clientId)
    }
  },

  methods: {
    async close () {
      // In a dedicated game window, Close closes the WINDOW (the lobby window already shows
      // /online — navigating there would leave two lobbies open). Close without navigating:
      // routing first would re-render the game page with cleared state before teardown.
      if (this.$windows.isGameWindow()) {
        if (this.onlineConnected) {
          this.$store.dispatch('networking/close', { redirect: false })
        } else {
          this.$store.dispatch('game/close', { redirect: false })
        }
        this.$windows.closeSelf()
        return
      }
      if (this.onlineConnected) {
        this.$router.push('/online')
      } else {
        this.$store.dispatch('game/close')
        this.$router.push('/')
      }
    },

    async playAgain () {
      const { setup, gameAnnotations } = this.$store.state.game
      // no redirect: the new game starts in THIS window (navigating home would close it)
      await this.$store.dispatch('game/close', { redirect: false })
      this.$store.dispatch('gameSetup/load', setup)
      this.$store.commit('gameSetup/gameAnnotations', gameAnnotations)
      await this.$store.dispatch('gameSetup/createGame')
    },

    async rematch () {
      const { setup: origSetup, gameAnnotations, slots } = this.$store.state.game
      // A rematch reuses the exact setup with a fixed roster: mark it so the slot page locks
      // the setup, the roster (no add/remove players), seating (no randomize), and the
      // public-game / hide-tiles options. Seating is deterministic (reverseSeatOrder), so
      // randomizeSeating is forced off.
      const setup = { ...origSetup, options: { ...(origSetup.options || {}), rematch: true, randomizeSeating: false } }
      // no redirect: the new game starts in THIS window (navigating home would close it)
      await this.$store.dispatch('game/close', { redirect: false })
      this.$store.dispatch('gameSetup/load', setup)
      this.$store.commit('gameSetup/gameAnnotations', gameAnnotations)
      const revertedSlots = reverseSeatOrder(slots)

      if (this.onlineConnected) {
        // online hotseat: the server assigns seating by TAKE_SLOT sequence — queue the seats
        // in the new (swapped) order and take them when the created game arrives
        const ordered = revertedSlots
          .filter(s => s.order !== undefined && s.order !== null)
          .sort((a, b) => a.order - b.order)
          .map(s => ({ number: s.number, name: s.name }))
        this.$store.commit('gameSetup/rematchSlots', ordered)
      }

      await this.$store.dispatch('gameSetup/createGame', {
        loadedSetup: setup,
        slots: revertedSlots
      })
    },

    toggleStats () {
      this.$store.commit('game/showGameStats', !this.showGameStats)
    }
  }
}
</script>

<style lang="sass" scoped>
section
  display: flex
  overflow: hidden

.standing
  padding-top: 20px
  flex-grow: 1
  display: flex
  justify-content: center
  align-items: center
  flex-wrap: wrap

.buttons
  display: flex
  justify-content: center
  align-items: center
  padding-right: 20px

  .v-btn
    margin-left: 10px

svg.meeple
  width: 55px
  height: 55px

.rank
  display: flex
  margin: 0 35px

  .coop-result
    align-self: center
    margin-left: 14px
    font-size: 22px
    font-weight: 500

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  .num
    position: relative
    top: -8px
    font-weight: 900
    font-size: 48px
    margin-right: 10px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

@media (max-width: 1024px)
  .close, .play-again, .toggle-stats
    text-indent: -9999px
    margin: 0
    min-width: 0
	
    .v-icon
      font-size: 24px
      margin: 0
      
@media (max-width: 1960px)
  svg.meeple
    width: 40px
    height: 40px

  .rank
    margin: 0 15px

    .num
      font-size: 36px

</style>
