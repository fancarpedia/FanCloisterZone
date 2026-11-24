<template>
  <div class="game-setup-grid view" :class="{ 'no-detail': !showDetail }">
    <header class="primary-header">
      <slot name="header" />
    </header>

    <header class="tiles-header">
      <!-- the open game (take a slot) page: clicking the deck counter opens the game's Tiles
           dialog, the same one as in the game (pages/game.vue) -->
      <TilePackSize
        v-if="showPackSize"
        :class="{ clickable: tilePackDialog }"
        :size="packSize"
        :setupPhase="true"
        @click.native="tilePackDialog && (tilePackOpen = true)"
      />
    </header>
    <v-dialog v-if="tilePackDialog" v-model="tilePackOpen" max-width="800">
      <TilePackDialog v-if="tilePackOpen" @close="tilePackOpen = false" />
    </v-dialog>

    <main>
      <slot name="main" />
    </main>

    <aside v-if="showDetail">
      <slot name="detail" />
    </aside>
  </div>
</template>

<script>
import TilePackSize from '@/components/game/TilePackSize'
import TilePackDialog from '@/components/game/dialogs/TilePackDialog'

import { getSelectedEdition, getSelectedStartingTiles } from '@/utils/gameSetupUtils'

export default {
  components: {
    TilePackDialog,
    TilePackSize
  },

  props: {
    sets: { type: Object, required: true },
    rules: { type: Object, required: true },
    // the setup providing elements/start/tileOverrides for the pack size; defaults to the
    // gameSetup store (setup editor) — open-game passes the game's own setup instead
    setup: { type: Object, default: null },
    showPackSize: { type: Boolean, default: true },
    showDetail: { type: Boolean, default: true },
    // the deck counter opens the game's Tiles dialog — only where state.game holds the game
    // (open-game), not in the setup editor (gameSetup store)
    tilePackDialog: { type: Boolean, default: false }
  },

  data () {
    return {
      tilePackOpen: false
    }
  },

  computed: {
    packSize () {
      // overrides are keyed by per-edition tile ids — size must be computed with the
      // edition/start the pack editor works against
      const setup = this.setup || this.$store.state.gameSetup || {}
      const edition = getSelectedEdition(setup.elements) || 1
      const start = getSelectedStartingTiles(setup.elements, setup.sets || this.sets, setup.start)
      return this.$tiles.getPackSize(this.sets, this.rules, setup.tileOverrides, edition, start)
    }
  }
}
</script>

<style lang="sass" scoped>
.tile-pack-size.clickable
  cursor: pointer

.game-setup-grid
  display: grid
  grid-template-columns: minmax(0, 1560px) minmax(372px, 1fr)
  // side by side, main and aside each scroll on their own: the grid is exactly one screen
  // high, so the content row is what is left under the header and never grows the page
  // (100dvh tracks the visible area under a mobile URL bar; 100vh is the fallback)
  height: 100vh
  height: 100dvh
  grid-template-rows: var(--game-setup-header-height) minmax(0, 1fr)
  grid-template-areas: "header tiles-header" "main detail"

  &.no-detail
    grid-template-areas: "header tiles-header" "main main"

  +theme using ($theme)
    background: map-get($theme, 'board-bg')

  ::v-deep .tile-pack-size
    .v-icon, .size
      font-size: 36px !important

    .size .v-icon
      font-size: 15px !important
      margin-bottom: 5px

header
  display: flex
  position: sticky
  top: 0
  z-index: 99

  +theme using ($theme)
    background-color: map-get($theme, 'cards-bg')
    color: map-get($theme, 'gray-text-color')
    border-bottom: 2px solid map-get($theme, 'board-bg')

  .text
    font-size: 20px
    font-weight: 300

.primary-header
  grid-area: header
  align-items: center
  justify-content: flex-end
  overflow-y: hidden
  padding: 0 30px

  .tabs
    flex: 1

  .v-btn
    margin-left: $button-gap

.tiles-header
  grid-area: tiles-header
  align-items: center
  justify-content: flex-start
  padding-left: 30px

// main and aside each scroll on their own, in both axes: content wider than its column scrolls
// inside that column instead of widening the grid (and with it the whole page)
main
  grid-area: main
  min-width: 0
  overflow-x: auto
  overflow-y: overlay
  padding-bottom: $panel-gap * 2
  margin-right: $panel-gap
  margin-top: -2px

  &.no-detail
    margin-right: 0

aside
  grid-area: detail
  min-width: 0
  overflow-x: auto
  overflow-y: overlay
  margin-top: -2px

@media (max-width: 1164px)
  .game-setup-grid
    // minmax(0, ...) — a bare 1fr track never shrinks below its widest content, which would
    // push the page into horizontal scroll instead of main/aside scrolling themselves
    grid-template-columns: minmax(0, 1fr)
    // stacked, the page scrolls as a whole again
    height: auto
    grid-template-rows: var(--game-setup-header-height) auto var(--game-setup-header-height) auto
    grid-template-areas: "header" "main" "tiles-header" "detail"

    .tiles-header
      position: static
      justify-content: center
      z-index: 0

  main
    margin-right: 0

@media (max-height: 768px)
  .game-setup-grid
    ::v-deep .tile-pack-size
      .v-icon, .size
        font-size: 28px !important
</style>
