<template>
  <section>
    <div class="standing">
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

export default {
  components: {
    Meeple
  },

  computed: {
    ...mapState({
      gameKey: state => state.game.key,
      showGameStats: state => state.game.showGameStats,
      onlineConnected: state => state.networking.connectionType === 'online'
    }),

    ...mapGetters({
      colorCssClass: 'game/colorCssClass',
      ranks: 'game/ranks'
    }),

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

    invertOrder(slots) {

      // Deep copy (keep objects intact but cloned)
      const result = slots.map(s => {
        const copy = JSON.parse(JSON.stringify(s))

        if ('gameId' in copy) {
          copy.gameId = null
        }
        if ('sessionId' in copy) {
          copy.sessionId = null
        }

        return copy
      })
      const orderedPlayers = result.filter(s => s.order !== undefined)

      const orders = orderedPlayers.map(s => s.order)

      if (orders.length === 2) {
        orderedPlayers[0].order = orders[1]
        orderedPlayers[1].order = orders[0]
        return result;
      }

      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); // without this is generating JS Error
            [arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr
      }

      const shuffledOrders = shuffle([...orders])

      orderedPlayers.forEach((player, i) => {
        player.order = shuffledOrders[i]
      });

      return result
    },

    async rematch () {
      const { setup, gameAnnotations, slots } = this.$store.state.game
      // no redirect: the new game starts in THIS window (navigating home would close it)
      await this.$store.dispatch('game/close', { redirect: false })
      this.$store.dispatch('gameSetup/load', setup)
      this.$store.commit('gameSetup/gameAnnotations', gameAnnotations)
      const revertedSlots = this.invertOrder(slots)

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
