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
        <!-- the coop variant is not supported for AI games (the AI can't reason about the
             enlarge-or-occupy obligation) — hidden like other ai:false elements -->
        <div
          v-if="!ai"
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

    <!-- time window for all popularity/leaderboard stats below -->
    <div v-if="online" class="range-selector">
      <v-btn-toggle v-model="range" mandatory dense @change="onRangeChange">
        <v-btn small value="month">{{ $t('game-setup.variant.range-month') }}</v-btn>
        <v-btn small value="year">{{ $t('game-setup.variant.range-year') }}</v-btn>
        <v-btn small value="all">{{ $t('game-setup.variant.range-all') }}</v-btn>
      </v-btn-toggle>
    </div>

    <!-- standard: most-popular sets & addons (player-count independent), above the setups -->
    <ConfigSection v-if="!coopVariant && online && (popularSets && popularSets.length)" :title="$t('game-setup.variant.popular-sets')">
      <div class="popular-chips">
        <div v-for="s in popularSets" :key="'set-' + s.id" class="popular-chip">
          <ExpansionSymbol v-if="expansionForSet(s.id)" class="chip-icon" :expansion="expansionForSet(s.id)" />
          <div class="chip-detail">
            <div class="chip-name">{{ setTitle(s.id) }}</div>
            <div class="chip-share">{{ $t('game-setup.variant.share-of-games', { percent: s.percent }) }}</div>
          </div>
          <div class="chip-percent">{{ s.percent }}%</div>
        </div>
      </div>
    </ConfigSection>

    <ConfigSection v-if="!coopVariant && online && (popularAddons && popularAddons.length)" :title="$t('game-setup.variant.popular-addons')">
      <div class="popular-chips">
        <div v-for="a in popularAddons" :key="'addon-' + a.id" class="popular-chip">
          <v-icon class="chip-icon addon-icon">fas fa-puzzle-piece</v-icon>
          <div class="chip-detail">
            <div class="chip-name">{{ addonTitle(a.id) }}</div>
            <div class="chip-share">{{ $t('game-setup.variant.share-of-games', { percent: a.percent }) }}</div>
          </div>
          <div class="chip-percent">{{ a.percent }}%</div>
        </div>
      </div>
    </ConfigSection>

    <ConfigSection v-if="!coopVariant && online && (popularComponents && popularComponents.length)" :title="$t('game-setup.variant.popular-components')">
      <div class="popular-chips">
        <div v-for="c in popularComponents" :key="'comp-' + c.id" class="popular-chip">
          <v-icon class="chip-icon addon-icon">fas fa-chess-pawn</v-icon>
          <div class="chip-detail">
            <div class="chip-name">{{ componentTitle(c.id) }}</div>
            <div class="chip-share">{{ $t('game-setup.variant.share-of-games', { percent: c.percent }) }}</div>
          </div>
          <div class="chip-percent">{{ c.percent }}%</div>
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
                  :tile-overrides="item.setup.tileOverrides"
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
              <div class="detail">
                <!-- top 3 score tiers; teams sharing a score share the rank medal -->
                <div v-for="tier in item.tiers" :key="tier.score" class="score-tier">
                  <span class="rank">{{ rankMedal(tier.rank) }}</span>
                  <span class="team-score">{{ tier.score }}</span>
                  <div class="tier-teams">
                    <div v-for="(team, ti) in tier.teams" :key="ti" class="team-names">
                      <span
                        v-for="(name, ni) in team.names"
                        :key="ni"
                        :class="{ me: isMe(team.clientIds[ni]) }"
                      >{{ name }}{{ ni !== team.names.length - 1 ? ', ' : '' }}</span>
                    </div>
                  </div>
                </div>
                <!-- the connected player's own best + latest score for this setup (hidden when
                     they've never played it) -->
                <div v-if="item.myBest !== undefined && item.myBest !== null" class="my-score">
                  {{ $t('game-setup.variant.your-score', { best: item.myBest, latest: item.myLatest }) }}
                </div>
                <!-- the setup shown the same way as in Open Game Windows -->
                <GameSetupOverviewInline
                  v-if="item.setup && item.setup.sets && item.setup.elements"
                  class="setup-overview"
                  :sets="item.setup.sets"
                  :elements="item.setup.elements"
                  :tile-overrides="item.setup.tileOverrides"
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
import ExpansionSymbol from '@/components/ExpansionSymbol'
import { Expansion } from '@/models/expansions'
import { GameElement } from '@/models/elements'

export default {
  components: {
    ConfigSection,
    GameSetupOverviewInline,
    ExpansionSymbol
  },

  data () {
    return {
      range: 'month' // time window for the popularity/leaderboard stats
    }
  },

  computed: {
    ...mapState({
      ai: state => !!state.gameSetup.ai,
      coopVariant: state => !!state.gameSetup.elements['keep-building'],
      leaderboard: state => state.gameSetup.coopLeaderboard,
      popular: state => state.gameSetup.standardPopular,
      popularSets: state => state.gameSetup.standardPopularSets,
      popularAddons: state => state.gameSetup.standardPopularAddons,
      popularComponents: state => state.gameSetup.standardPopularComponents,
      online: state => state.networking.connectionType === 'online'
    }),

    // leaderboard grouped by player count, then by setup. Within a setup the teams are grouped
    // BY POINTS into ranks: all teams with the same score share one rank (🥇/🥈/🥉), listed
    // oldest→newest, capped at 3 teams per rank; only the top 3 score tiers are shown.
    grouped () {
      const byPlayers = new Map()
      for (const item of this.leaderboard || []) {
        if (!byPlayers.has(item.players)) byPlayers.set(item.players, new Map())
        const bySetup = byPlayers.get(item.players)
        if (!bySetup.has(item.setupHash)) {
          bySetup.set(item.setupHash, {
            setupHash: item.setupHash,
            setup: item.setup,
            teams: [],
            // the requesting client's own best/latest score for this setup (server-computed);
            // undefined when the client has no game of it → the "your score" line is hidden
            myBest: item.myBest,
            myLatest: item.myLatest
          })
        }
        bySetup.get(item.setupHash).teams.push({
          names: item.names || [],
          clientIds: item.clientIds || [],
          score: item.score,
          finished: item.finished
        })
      }
      const buildTiers = teams => {
        const byScore = new Map()
        for (const t of teams) {
          if (!byScore.has(t.score)) byScore.set(t.score, [])
          byScore.get(t.score).push(t)
        }
        return [...byScore.entries()]
          .sort((a, b) => b[0] - a[0]) // best score first
          .slice(0, 3) // top 3 score tiers = ranks 1/2/3
          .map(([score, tierTeams], rank) => ({
            rank,
            score,
            // ties: oldest→newest, at most 3 shown
            teams: tierTeams.sort((a, b) => a.finished - b.finished).slice(0, 3)
          }))
      }
      return [...byPlayers.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([players, bySetup]) => ({
          players,
          items: [...bySetup.values()]
            .map(it => ({
              setupHash: it.setupHash,
              setup: it.setup,
              tiers: buildTiers(it.teams),
              myBest: it.myBest,
              myLatest: it.myLatest
            }))
            .sort((a, b) => (b.tiers[0] ? b.tiers[0].score : 0) - (a.tiers[0] ? a.tiers[0].score : 0))
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
    // 🥇/🥈/🥉 for the top three, then a plain ordinal
    rankMedal (idx) {
      return ['🥇', '🥈', '🥉'][idx] || (idx + 1) + '.'
    },

    // true when a stored player's clientId is THIS connected client (highlight own name).
    // dev mode suffixes the clientId per window (base--suffix) — compare on the base.
    isMe (clientId) {
      if (!clientId) return false
      const mine = this.$store.state.settings.clientId
      if (!mine) return false
      return clientId.split('--')[0] === mine.split('--')[0]
    },

    selectVariant (coop) {
      if (coop === this.coopVariant) return
      this.$store.dispatch('gameSetup/setElementConfig', { id: 'keep-building', config: coop })
    },

    // re-query the currently shown stats view with the new time window
    onRangeChange () {
      if (this.coopVariant) this.fetchLeaderboard()
      else this.fetchPopular()
    },

    fetchLeaderboard () {
      this.$store.dispatch('gameSetup/fetchCoopLeaderboard', { range: this.range })
    },

    fetchPopular () {
      this.$store.dispatch('gameSetup/fetchStandardPopular', { range: this.range })
    },

    // the Expansion a popular set id belongs to (server sends ids with the :edition suffix
    // already stripped, matching the release set ids like `inns_and_cathedrals`, `river/1`)
    expansionForSet (setId) {
      return Expansion.all().find(exp => exp.releases.some(r => r.sets.includes(setId))) || null
    },

    setTitle (setId) {
      const exp = this.expansionForSet(setId)
      if (exp) {
        const key = 'expansion.' + exp.name.toLowerCase().replace(/_/g, '-')
        return this.$te(key) ? this.$t(key) : exp.title
      }
      return setId
    },

    addonTitle (id) {
      const addon = (this.$addons.addons || []).find(a => a.id === id)
      return (addon && (addon.title || addon.json.title)) || id
    },

    componentTitle (id) {
      const key = 'game.element.' + id
      if (this.$te(key)) return this.$t(key)
      const el = GameElement.get(id)
      return (el && el.title) || id
    },

    // load the stored setup and start the game with it right away
    async playSetup (item, coop = true) {
      const setup = { ...item.setup }
      setup.elements = { ...(setup.elements || {}), 'keep-building': coop }
      // "Play it" launches a BRAND NEW game from a leaderboard entry. If the user reached the
      // variant tab via change-setup, editingGameId is still set and createGame would send
      // UPDATE_GAME_SETUP (silently editing the current game, no navigation) — i.e. the button
      // appears to do nothing. Clear it so createGame always creates + navigates.
      this.$store.commit('gameSetup/setEditingGameId', null)
      await this.$store.dispatch('gameSetup/load', setup)
      await this.$store.dispatch('gameSetup/createGame')
    }
  }
}
</script>

<style lang="sass" scoped>
.variant-tab
  padding: 20px

.range-selector
  display: flex
  justify-content: flex-end
  margin-bottom: 12px

.popular-chips
  display: flex
  flex-wrap: wrap
  gap: 10px

.popular-chip
  display: flex
  align-items: center
  gap: 12px
  min-width: 240px
  padding: 8px 14px
  border-radius: 6px

  +theme using ($theme)
    background: map-get($theme, 'cards-bg')
    color: map-get($theme, 'cards-text')

  .chip-icon
    width: 42px
    height: 42px
    flex: 0 0 auto

    +theme using ($theme)
      fill: map-get($theme, 'overview-tile-fill')

    &.addon-icon
      font-size: 34px
      +theme using ($theme)
        color: map-get($theme, 'overview-tile-fill')

  .chip-detail
    flex: 1

    .chip-name
      font-weight: 500

    .chip-share
      font-size: 12px
      opacity: 0.7

  .chip-percent
    font-size: 22px
    font-weight: bold
    color: var(--v-primary-base)

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

  .detail
    flex: 1

    .score-tier
      display: flex
      align-items: baseline
      gap: 10px
      margin-bottom: 2px

      .rank
        min-width: 24px

      .team-score
        font-weight: bold
        min-width: 48px
        text-align: right
        color: var(--v-primary-base)

      .tier-teams
        .team-names
          font-weight: 500

          // the connected player's own name is highlighted
          .me
            font-weight: 700
            color: var(--v-primary-base)

    .my-score
      margin-top: 4px
      font-size: 13px
      font-weight: 600
      color: var(--v-primary-base)

    // same rendering as the Open Game Windows aside (zoom reflows, unlike transform: scale)
    .setup-overview
      margin-top: 4px
      zoom: 0.78
</style>
