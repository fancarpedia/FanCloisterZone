<template>
  <div class="game-setup-page">
  <GameSetupGrid v-if="loaded" :sets="sets" :rules="rules" :show-detail="tab > 0" :show-pack-size="tab > 0">
    <template #header>
      <v-tabs v-model="tab" @change="onTabChange">
        <!-- bookmarks make no sense when editing an already-created game's setup -->
        <v-tab :disabled="editingGame"><v-icon small>far fa-heart</v-icon></v-tab>
        <v-tab><v-icon small class="icon">fas fa-square</v-icon>{{ $t('game-setup.header.tiles') }}</v-tab>
        <v-tab active-class="active">
          <div class="meeple icon">
            <Meeple type="SmallFollower" />
          </div>
          {{ $t('game-setup.header.components') }}
        </v-tab>
        <v-tab><v-icon small class="icon">fas fa-book</v-icon>{{ $t('game-setup.header.rules') }}</v-tab>
        <v-tab><v-icon small class="icon">far fa-clock</v-icon>{{ $t('game-setup.header.game-flow') }}</v-tab>
      </v-tabs>

      <HeaderMessage v-if="tab > 0" :sets="sets" />
      <!-- wizard: Next steps tiles → components → rules → game flow; Create only on the last tab -->
      <HeaderGameButton
        v-if="tab > 0"
        :title="$t(tab < 4 ? 'button.next' : (gameId !== null ? 'button.continue' : 'button.create'))"
        :sets="sets"
        @click="nextOrCreate"
      />
      <HeaderLeaveGameButton :title="$t('menu.leave-game')" @click="leaveGame" />
      
    </template>

    <template #main>
      <BookmarksTab v-show="tab === 0" @load="tab = 1" @select="selectedSetupDetail = $event" />
      <TileSetsTab v-show="tab === 1" />
      <FiguresTab v-show="tab === 2" />
      <RulesTab v-show="tab === 3" />
      <TimerTab v-show="tab === 4" />
    </template>

    <template #detail>
      <div v-if="tab > 0" class="detail-pack">
        <h2>{{ $t('game-setup.selected-tiles') }}</h2>
        <TileDistribution
          :tile-size="$vuetify.breakpoint.height > 768 ? 100 : 80"
          :sets="sets"
          :rules="rules"
          editable
          @tile-click="onTileClick"
        />
        <GameAnnotationsPanel v-if="settings.devMode" ref="annotationsPanel" />
      </div>
    </template>
  </GameSetupGrid>
  <SetupChatLauncher />
  </div>
</template>

<script>
import { ipcRenderer } from 'electron'
import debounce from 'lodash/debounce'
import { mapGetters, mapState } from 'vuex'

import BookmarksTab from '@/components/game-setup/tabs/BookmarksTab'
import FiguresTab from '@/components/game-setup/tabs/FiguresTab'
import GameAnnotationsPanel from '@/components/dev/GameAnnotationsPanel'
import GameSetupGrid from '@/components/game-setup/GameSetupGrid'
import HeaderMessage from '@/components/game-setup/HeaderMessage'
import HeaderGameButton from '@/components/game-setup/HeaderGameButton'
import HeaderLeaveGameButton from '@/components/game-setup/HeaderLeaveGameButton'
import Meeple from '@/components/game/Meeple'
import TileDistribution from '@/components/TileDistribution'
import TileSetsTab from '@/components/game-setup/tabs/TileSetsTab'
import TimerTab from '@/components/game-setup/tabs/TimerTab'
import RulesTab from '@/components/game-setup/tabs/RulesTab'
import SetupChatLauncher from '@/components/game-setup/SetupChatLauncher'

export default {
  components: {
    BookmarksTab,
    FiguresTab,
    GameSetupGrid,
    GameAnnotationsPanel,
    HeaderMessage,
    HeaderGameButton,
    HeaderLeaveGameButton,
    Meeple,
    TileDistribution,
    TileSetsTab,
    TimerTab,
    RulesTab,
    SetupChatLauncher
  },

  data () {
    const editing = this.$store.state.gameSetup.editingGameId != null
    const tabParam = this.$route.query.tab
    return {
      // editing an existing game: bookmarks tab is disabled, so never start on it
      tab: editing ? Math.max(1, ~~tabParam) : (tabParam === undefined ? 1 : ~~tabParam),
      selectedSetupDetail: null
    }
  },

  computed: {
    ...mapState({
      ai: state => state.gameSetup.ai,
      editingGame: state => state.gameSetup.editingGameId != null,
      gameId: state => state.game.id,
      sets: state => state.gameSetup.sets,
      rules: state => state.gameSetup.rules,
      detail: state => state.gameSetup.detail,
      settings: state => state.settings
    }),

    ...mapGetters({
      loaded: 'loaded'
    })
  },

  beforeCreate () {
    // useful for dev mode, if setup not exist, redirect to home
    if (this.$store.state.gameSetup.sets == null) {
      this.$store.dispatch('game/close')
      this.$router.push('/')
      // it would be nice to create one, but also wait for artwork load is needed
      // this.$store.dispatch('gameSetup/newGame')
    }
  },

  created () {
    // While editing an already-created online game, broadcast every setup change (debounced)
    // so all connected players see it immediately on the slot page — not only after Continue.
    this._pushSetupUpdate = debounce(() => {
      this.$store.dispatch('gameSetup/pushSetupUpdate')
    }, 400)
    this._unwatchSetup = this.$store.watch(
      state => [state.gameSetup.sets, state.gameSetup.elements, state.gameSetup.rules,
        state.gameSetup.timer, state.gameSetup.start, state.gameSetup.tileOverrides],
      () => {
        if (this.$store.state.gameSetup.editingGameId) {
          this._pushSetupUpdate()
        }
      },
      { deep: true }
    )
  },

  beforeDestroy () {
    this._unwatchSetup && this._unwatchSetup()
    this._pushSetupUpdate && this._pushSetupUpdate.cancel()
  },

  methods: {
    async nextOrCreate () {
      if (this.tab < 4) {
        this.tab += 1
        window.scrollTo(0, 0)
        return
      }
      await this.createGame()
    },

    async createGame () {
      await this.$store.dispatch('gameSetup/createGame')
    },

    async leaveGame () {
      await ipcRenderer.emit('menu.leave-game')
    },

    onTileClick (tileId, maxCount) {
      if (this.settings.devMode) {
        this.$refs.annotationsPanel.appendTile(tileId, maxCount)
      }
    },

    onTabChange () {
      window.scrollTo(0, 0)
    }
  }
}
</script>

<style lang="sass" scoped>
*
  user-select: none

// transparent wrapper (added only to host the floating GlobalChat bullet) — no layout impact
.game-setup-page
  display: contents

.detail-pack
  padding: 20px

  h2
    text-align: center
    margin-bottom: $panel-gap

    font-weight: 300
    font-size: 16px
    text-transform: uppercase

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

header
  .warning-text, .info-text
    font-size: 24px
    white-space: nowrap
    background-color: #F44336
    color: white
    padding: 0 20px
    border-radius: 4px

.dev-panel
  border-top: 1px solid black
  margin-top: 20px
  opacity: 0.1
  min-height: 200px

  &.visible
    opacity: 1

  h5
    margin-top: 10px
    text-align: center
    
.meeple
  svg
    width: 18px
    height: 18px
    +theme using ($theme)
      fill: map-get($theme, 'cards-text')

.active
  .meeple
    svg
      fill: var(--v-primary-base) !important
      
.icon, .meeple
  margin-right: 1ex
  
@media (max-height: 768px)
  .detail-pack
    padding: 10px

</style>
