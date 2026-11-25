<template>
  <div class="game-setup-page">
  <GameSetupGrid v-if="loaded" :sets="sets" :rules="rules" :show-detail="tab > 1" :show-pack-size="tab > 1">
    <template #header>
      <v-tabs v-model="tab" @change="onTabChange">
        <!-- bookmarks make no sense when editing an already-created game's setup -->
        <v-tab :disabled="editingGame"><v-icon small>far fa-heart</v-icon></v-tab>
        <!-- the names hide on narrow windows (icons only, the name as a tooltip) so every tab fits -->
        <v-tab :title="$t('game-setup.header.variant')"><v-icon small class="icon">fas fa-users</v-icon><span class="tab-label">{{ $t('game-setup.header.variant') }}</span></v-tab>
        <v-tab :title="$t('game-setup.header.tiles')"><svg class="icon tile-back-icon" viewBox="0 0 134.91 134.89" aria-hidden="true"><path fill="currentColor" d="M134.9,67.46c0-16.82-.01-33.64.01-50.46,0-3.33-.67-6.44-2.5-9.24C129.07,2.63,124.29.02,118.18.02,88.61,0,59.04,0,29.46,0,25.14,0,20.82-.01,16.49.01,8.66.06,2.11,5.33.41,12.97.14,14.17.02,15.44.02,16.67,0,50.54-.02,84.4.03,118.27c0,6.63,3.08,11.6,8.9,14.79,2.53,1.39,5.28,1.83,8.15,1.83,33.79-.02,67.57,0,101.36-.02,7.98,0,14.5-5.34,16.13-13.16.27-1.29.31-2.64.32-3.96.02-16.77.01-33.53.01-50.3ZM78.84,14.55c0,.11,0,.22,0,.32,5.18,0,10.36-.07,15.55.02,6.37.11,12.74.35,19.11.54.25,0,.5.04.74.09,2.25.48,2.96,1.74,2.13,3.88-1.14,2.94-2.29,5.87-3.48,8.79-2.32,5.71-4.67,11.41-7.02,17.11-.63,1.53-.75,1.58-2.43,1.53-.61-.02-1.21,0-1.82,0-.6-.01-1.18-.11-1.45-.75-.27-.63.24-.95.57-1.35,1.33-1.59,2.77-3.11,3.95-4.81,2.07-2.97-.52-6.71-3.45-6.75-10.53-.15-21.05-.53-31.58-.71-10.11-.17-20.23-.2-30.32.71-1.4.13-2.26.82-2.71,2.08-.49,1.37-.63,2.79-.48,4.25.46,4.41,1.76,8.61,3.2,12.76,3.59,10.28,8.46,19.95,13.93,29.34,5.11,8.77,11.02,16.99,16.73,25.37,2.46,3.61,5.76,5.43,10.04,5.73,1.72.12,3.22-.2,4.53-1.37,2.21-1.97,4.54-3.82,6.68-5.86,2.66-2.55,5.17-5.25,7.74-7.89.82-.84,1.4-.91,2.17-.05.57.65,1,1.45,1.42,2.21.37.68.22,1.31-.32,1.89-1.44,1.53-2.82,3.13-4.29,4.63-3.97,4.04-8.13,7.85-13.08,10.71-3.47,2-7.17,3.17-11.19,3.27-6.15.16-11.51-1.71-15.78-6.25-7.7-8.19-14.7-16.94-20.94-26.3-5.56-8.34-10.79-16.89-14.8-26.11-1.71-3.93-3.21-7.95-3.85-12.22-.24-1.61.02-3.02,1.09-4.35,2.03-2.52,3.92-5.16,5.94-7.69,5.21-6.54,10.45-13.06,15.69-19.58,1.31-1.63,3.02-2.44,5.12-2.47,2.38-.03,4.76-.12,7.15-.17,8.51-.18,17.01-.36,25.52-.53Z" /></svg><span class="tab-label">{{ $t('game-setup.header.tiles') }}</span></v-tab>
        <v-tab active-class="active" :title="$t('game-setup.header.components')">
          <div class="meeple icon">
            <Meeple type="SmallFollower" />
          </div>
          <span class="tab-label">{{ $t('game-setup.header.components') }}</span>
        </v-tab>
        <v-tab :title="$t('game-setup.header.rules')"><v-icon small class="icon">fas fa-book</v-icon><span class="tab-label">{{ $t('game-setup.header.rules') }}</span></v-tab>
        <v-tab :title="$t('game-setup.header.game-setup')"><v-icon small class="icon">far fa-clock</v-icon><span class="tab-label">{{ $t('game-setup.header.game-setup') }}</span></v-tab>
      </v-tabs>
    </template>

    <!-- after the tile count, in the header above the aside: the setup warnings, the "no AI"
         badge, the draw-order alert, Next / Create and Leave -->
    <template #tiles-header-actions>
      <HeaderMessage v-if="tab > 1" :sets="sets" />
      <!-- wizard: Next steps variant → tiles → components → rules → game flow; Create only on the last tab.
           In change mode there is no wizard — always Continue (user tweaks one thing on one tab). -->
      <!-- dev mode: a draw order holding more copies of a tile than the game has (the count was
           lowered, or the set removed, after the tile went into the order) blocks the game -->
      <!-- an icon only (the aside header is narrow); the message and the tiles in the tooltip -->
      <span
        v-if="drawOrderOverflow.length"
        class="draw-order-overflow"
        :title="$t('game-setup.tiles.draw-order-overflow', { tiles: drawOrderOverflow.join(', ') })"
      >
        <v-icon>fas fa-exclamation-triangle</v-icon>
      </span>
      <!-- something the AI does not play is chosen → no AI players in this game; right before
           Next / Create. Not on the bookmarks / variant tabs: no tiles chosen there yet -->
      <AiSupportBadge v-if="tab > 1" />
      <HeaderGameButton
        v-if="tab > 0"
        :title="$t(editingGame ? 'button.continue' : (tab < 5 ? 'button.next' : (gameId !== null ? 'button.continue' : 'button.create')))"
        :sets="sets"
        :disabled="drawOrderOverflow.length > 0"
        @click="nextOrCreate"
      />
      <HeaderLeaveGameButton :title="$t('menu.leave-game')" @click="leaveGame" />
    </template>

    <template #main>
      <BookmarksTab v-show="tab === 0" @load="tab = 2" @select="selectedSetupDetail = $event" />
      <VariantTab v-show="tab === 1" />
      <TileSetsTab v-show="tab === 2" />
      <FiguresTab v-show="tab === 3" />
      <RulesTab v-show="tab === 4" />
      <TimerTab v-show="tab === 5" />
    </template>

    <template #detail>
      <div v-if="tab > 1" class="detail-pack">
        <h2>{{ $t('game-setup.selected-tiles') }}</h2>
        <TileDistribution
          :tile-size="$vuetify.breakpoint.height > 768 ? 100 : 80"
          :sets="sets"
          :rules="rules"
          editable
          :allow-quantity-change="!coopVariant"
          :sequenced="settings.devMode ? sequencedCounts : null"
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

import { getSelectedEdition, getSelectedStartingTiles } from '@/utils/gameSetupUtils'

import BookmarksTab from '@/components/game-setup/tabs/BookmarksTab'
import FiguresTab from '@/components/game-setup/tabs/FiguresTab'
import GameAnnotationsPanel from '@/components/dev/GameAnnotationsPanel'
import GameSetupGrid from '@/components/game-setup/GameSetupGrid'
import HeaderMessage from '@/components/game-setup/HeaderMessage'
import AiSupportBadge from '@/components/game-setup/AiSupportBadge'
import HeaderGameButton from '@/components/game-setup/HeaderGameButton'
import HeaderLeaveGameButton from '@/components/game-setup/HeaderLeaveGameButton'
import Meeple from '@/components/game/Meeple'
import TileDistribution from '@/components/TileDistribution'
import TileSetsTab from '@/components/game-setup/tabs/TileSetsTab'
import TimerTab from '@/components/game-setup/tabs/TimerTab'
import RulesTab from '@/components/game-setup/tabs/RulesTab'
import SetupChatLauncher from '@/components/game-setup/SetupChatLauncher'
import VariantTab from '@/components/game-setup/tabs/VariantTab'

export default {
  components: {
    AiSupportBadge,
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
    SetupChatLauncher,
    VariantTab
  },

  data () {
    const editing = this.$store.state.gameSetup.editingGameId != null
    const tabParam = this.$route.query.tab
    return {
      // editing an existing game: bookmarks tab is disabled (and the variant is settled), start on tiles;
      // a fresh setup starts on the Favorites tab when there is at least one favourite (pick one and go),
      // otherwise on the Variant tab (standard vs cooperative choice)
      tab: editing
        ? Math.max(2, ~~tabParam)
        : (tabParam === undefined ? ((this.$store.state.settings.mySetups || []).length > 0 ? 0 : 1) : ~~tabParam),
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
      settings: state => state.settings,
      // Keep Building (coop) plays the standard pack — tile-count editing is disabled for it
      coopVariant: state => !!(state.gameSetup.elements || {})['keep-building']
    }),

    ...mapGetters({
      loaded: 'loaded'
    }),

    // dev mode: the tiles the draw order holds more copies of than the game has (count lowered or
    // its set removed after it went into the order) — the game can't be created like that
    drawOrderOverflow () {
      if (!this.settings.devMode) return []
      const setup = this.$store.state.gameSetup
      const edition = getSelectedEdition(setup.elements) || 1
      const start = getSelectedStartingTiles(setup.elements, setup.sets, setup.start)
      const counts = this.$tiles.applyTileOverrides(
        this.$tiles.getTilesCounts(this.sets, this.rules, edition, start),
        setup.tileOverrides
      )
      return Object.entries(this.sequencedCounts)
        .filter(([id, n]) => n > (counts[id] || 0))
        .map(([id]) => id)
    },

    // dev mode: how many copies of each tile the draw order (GameAnnotationsPanel) already holds
    sequencedCounts () {
      const counts = {}
      for (const id of (this.$store.state.gameSetup.gameAnnotations?.drawOrder || [])) {
        counts[id] = (counts[id] || 0) + 1
      }
      return counts
    }
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
      // change mode: no wizard stepping — Continue commits the edited setup from any tab
      if (!this.editingGame && this.tab < 5) {
        this.tab += 1
        this.scrollToTop()
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
      this.scrollToTop()
    },

    // side by side the main panel scrolls on its own; stacked (narrow) the page does
    scrollToTop () {
      window.scrollTo(0, 0)
      const main = this.$el && this.$el.querySelector && this.$el.querySelector('.game-setup-grid > main')
      if (main) main.scrollTop = 0
    }
  }
}
</script>

<style lang="sass" scoped>
.draw-order-overflow
  display: inline-flex
  align-items: center
  cursor: help

  .v-icon
    color: #D32F2F

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
