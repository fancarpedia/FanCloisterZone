<template>
  <div class="variant-tab">
    <ConfigSection :title="$t('game-setup.variant.choose-variant')">
      <div class="variant-boxes">
        <div
          class="variant-box"
          :class="{ selected: !coopVariant }"
          @click="selectVariant(false)"
        >
          <h3>{{ $t('game-setup.variant.standard') }}</h3>
          <p>{{ $t('game-setup.variant.standard-description') }}</p>
          <div class="toggle"><v-icon v-if="!coopVariant">fas fa-check</v-icon></div>
        </div>
        <div
          class="variant-box"
          :class="{ selected: coopVariant }"
          @click="selectVariant(true)"
        >
          <h3>{{ $t('game.feature.keep-building') }}</h3>
          <p>{{ $t('game-setup.game-flow.keep-building-description') }}</p>
          <div class="toggle"><v-icon v-if="coopVariant">fas fa-check</v-icon></div>
        </div>
      </div>
    </ConfigSection>

    <!-- standard: most-played setups, grouped by player count; picking one starts the game -->
    <ConfigSection v-if="!coopVariant" :title="$t('game-setup.variant.popular-setups')">
      <div v-if="!online" class="hint">
        {{ $t('game-setup.variant.popular-online-only') }}
      </div>
      <div v-else-if="popular === null" class="hint">
        {{ $t('game-setup.variant.leaderboard-loading') }}
      </div>
      <div v-else-if="!popular.length" class="hint">
        {{ $t('game-setup.variant.popular-empty') }}
      </div>
      <template v-else>
        <div v-for="group in popularGrouped" :key="'p' + group.players" class="leaderboard-group">
          <h3>{{ $t('game-setup.variant.n-players', { players: group.players }) }}</h3>
          <div class="leaderboard-rows">
            <div
              v-for="item in group.items"
              :key="item.setupHash"
              class="leaderboard-row"
              @click="playSetup(item, false)"
            >
              <div class="score">{{ item.percent }}%</div>
              <div class="detail">
                <div class="names">{{ $t('game-setup.variant.share-of-games', { percent: item.percent }) }}</div>
                <GameSetupOverviewInline
                  v-if="item.setup && item.setup.sets && item.setup.elements"
                  class="setup-overview"
                  :sets="item.setup.sets"
                  :elements="item.setup.elements"
                />
              </div>
              <v-btn small color="primary" @click.stop="playSetup(item, false)">
                {{ $t('game-setup.variant.play-it') }}
              </v-btn>
            </div>
          </div>
        </div>
      </template>
    </ConfigSection>

    <!-- best stored setups (won coop games), grouped by player count; picking one starts the game -->
    <ConfigSection v-if="coopVariant" :title="$t('game-setup.variant.best-setups')">
      <div v-if="!online" class="hint">
        {{ $t('game-setup.variant.leaderboard-online-only') }}
      </div>
      <div v-else-if="leaderboard === null" class="hint">
        {{ $t('game-setup.variant.leaderboard-loading') }}
      </div>
      <div v-else-if="!leaderboard.length" class="hint">
        {{ $t('game-setup.variant.leaderboard-empty') }}
      </div>
      <template v-else>
        <div v-for="group in grouped" :key="group.players" class="leaderboard-group">
          <h3>{{ $t('game-setup.variant.n-players', { players: group.players }) }}</h3>
          <div class="leaderboard-rows">
            <div
              v-for="item in group.items"
              :key="item.setupHash"
              class="leaderboard-row"
              @click="playSetup(item)"
            >
              <div class="score">{{ item.score }}</div>
              <div class="detail">
                <!-- every team that achieved the top score (usually one, more on a tie) -->
                <div v-for="(team, idx) in item.teams" :key="idx" class="names">
                  {{ team.names.join(', ') }}
                </div>
                <!-- the setup shown the same way as in Open Game Windows -->
                <GameSetupOverviewInline
                  v-if="item.setup && item.setup.sets && item.setup.elements"
                  class="setup-overview"
                  :sets="item.setup.sets"
                  :elements="item.setup.elements"
                />
              </div>
              <v-btn small color="primary" @click.stop="playSetup(item)">
                {{ $t('game-setup.variant.play-it') }}
              </v-btn>
            </div>
          </div>
        </div>
      </template>
    </ConfigSection>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ConfigSection from '@/components/game-setup/ConfigSection'
import GameSetupOverviewInline from '@/components/game-setup/overview/GameSetupOverviewInline'

export default {
  components: {
    ConfigSection,
    GameSetupOverviewInline
  },

  computed: {
    ...mapState({
      coopVariant: state => !!state.gameSetup.elements['keep-building'],
      leaderboard: state => state.gameSetup.coopLeaderboard,
      popular: state => state.gameSetup.standardPopular,
      online: state => state.networking.connectionType === 'online'
    }),

    // leaderboard items grouped by player count, then by setup: the server returns one
    // item per game holding the top score, so a tie yields several items with the same
    // setupHash+score — collapse them into a single row listing every tied team
    grouped () {
      const byPlayers = new Map()
      for (const item of this.leaderboard || []) {
        if (!byPlayers.has(item.players)) byPlayers.set(item.players, new Map())
        const bySetup = byPlayers.get(item.players)
        if (!bySetup.has(item.setupHash)) {
          bySetup.set(item.setupHash, {
            setupHash: item.setupHash,
            setup: item.setup,
            score: item.score,
            teams: []
          })
        }
        bySetup.get(item.setupHash).teams.push({
          names: item.names || [],
          finished: item.finished
        })
      }
      return [...byPlayers.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([players, bySetup]) => ({
          players,
          items: [...bySetup.values()].sort((a, b) => b.score - a.score)
        }))
    },

    // most-played standard setups grouped by player count (server pre-aggregates: top 5
    // setups per player count, each with its share among finished games of that count)
    popularGrouped () {
      const byPlayers = new Map()
      for (const item of this.popular || []) {
        if (!byPlayers.has(item.players)) byPlayers.set(item.players, [])
        byPlayers.get(item.players).push(item)
      }
      return [...byPlayers.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([players, items]) => ({
          players,
          items: [...items].sort((a, b) => b.percent - a.percent).slice(0, 5)
        }))
    }
  },

  watch: {
    coopVariant (val) {
      if (val) this.fetchLeaderboard()
      else this.fetchPopular()
    }
  },

  mounted () {
    if (this.coopVariant) this.fetchLeaderboard()
    else this.fetchPopular()
  },

  methods: {
    selectVariant (coop) {
      if (coop === this.coopVariant) return
      this.$store.dispatch('gameSetup/setElementConfig', { id: 'keep-building', config: coop })
    },

    fetchLeaderboard () {
      this.$store.dispatch('gameSetup/fetchCoopLeaderboard', {})
    },

    fetchPopular () {
      this.$store.dispatch('gameSetup/fetchStandardPopular', {})
    },

    // load the stored setup and start the game with it right away
    async playSetup (item, coop = true) {
      const setup = { ...item.setup }
      setup.elements = { ...(setup.elements || {}), 'keep-building': coop }
      await this.$store.dispatch('gameSetup/load', setup)
      await this.$store.dispatch('gameSetup/createGame')
    }
  }
}
</script>

<style lang="sass" scoped>
.variant-tab
  padding: 20px

.variant-boxes
  display: flex
  gap: 20px

.variant-box
  flex: 1
  max-width: 420px
  cursor: pointer
  border-radius: 6px
  padding: 16px
  position: relative

  +theme using ($theme)
    background: map-get($theme, 'cards-bg')
    color: map-get($theme, 'cards-text')

  &.selected
    outline: 2px solid var(--v-primary-base)

  h3
    margin-bottom: 8px

  p
    font-size: 14px
    margin: 0 0 24px

  .toggle
    position: absolute
    right: 12px
    bottom: 8px

    i
      color: var(--v-primary-base)

.hint
  padding: 10px 4px
  font-style: italic

.leaderboard-group
  margin-bottom: 16px

  h3
    margin-bottom: 6px

.leaderboard-rows
  display: flex
  flex-direction: column
  gap: 6px

.leaderboard-row
  display: flex
  align-items: center
  gap: 14px
  padding: 8px 12px
  border-radius: 4px
  cursor: pointer

  +theme using ($theme)
    background: map-get($theme, 'cards-bg')
    color: map-get($theme, 'cards-text')

  .score
    font-size: 26px
    font-weight: bold
    min-width: 64px
    text-align: right
    color: var(--v-primary-base)

  .detail
    flex: 1

    .names
      font-weight: 500

    // same rendering as the Open Game Windows aside (zoom reflows, unlike transform: scale)
    .setup-overview
      margin-top: 4px
      zoom: 0.78
</style>
