<template>
  <div class="game-setup-grid view" :class="{ 'no-detail': !showDetail }">
    <header class="primary-header">
      <slot name="header" />
    </header>

    <header class="tiles-header" :class="{ 'no-pack': !showPackSize }">
      <!-- the open game (take a slot) page: clicking the deck counter opens the game's Tiles
           dialog, the same one as in the game (pages/game.vue) -->
      <TilePackSize
        v-if="showPackSize"
        :class="{ clickable: tilePackDialog }"
        :size="packSize"
        :setupPhase="true"
        @click.native="tilePackDialog && (tilePackOpen = true)"
      />
      <!-- the page's actions after the tile count (game-setup: warnings, AI badge, Next / Create) -->
      <div v-if="$slots['tiles-header-actions']" class="tiles-header-actions">
        <slot name="tiles-header-actions" />
      </div>
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
  // only the tabs live here now (the actions moved to the tiles header): start them at the
  // left edge, without the wide padding that left an empty strip before the first tab
  justify-content: flex-start
  overflow-y: hidden
  padding: 0 8px

  .tabs
    flex: 1

  // the Tiles tab's icon: the tile back, as for "tiles" in the final scoring stats — inline SVG
  // (assets/icons/back.svg's path) filled with the tab's text colour, so it is grey / highlighted
  // exactly like the other tab icons, in the light and the dark theme. Not a CSS mask: the desktop
  // app did not load the mask image and painted a plain square.
  ::v-deep .tile-back-icon
    width: 16px
    height: 16px
    margin-right: 8px
    flex: 0 0 auto

  // the active tab's underline drawn on the tab itself: Vuetify's sliding bar is measured once and
  // came out too short when the active tab's name appears only once it is active (narrow windows)
  ::v-deep .v-tabs-slider-wrapper
    display: none

  ::v-deep .v-tab--active
    box-shadow: inset 0 -2px 0 currentColor

  // Vuetify keeps an empty 52px "previous" arrow box at the left once the tabs overflow (the
  // arrow itself disabled) — a blank strip covering the first tab. Never show these boxes.
  ::v-deep .v-slide-group__prev, ::v-deep .v-slide-group__next
    display: none !important

  // narrow: the tabs show only their icons (game-setup.vue wraps each name in .tab-label)
  @media (max-width: 1100px)
    ::v-deep .tab-label
      display: none

    ::v-deep .v-tab
      min-width: 0
      padding: 0 14px

      .icon
        margin-right: 0 !important

      // the active tab keeps its name, so you still see where you are
      &.v-tab--active
        .tab-label
          display: inline

        .icon
          margin-right: 8px !important

  .v-btn
    margin-left: $button-gap

.tiles-header
  grid-area: tiles-header
  align-items: center
  // Above the aside: the count on the left, the actions (⚠ / AI / Next / x) as one group on the
  // right — Next and x always side by side. --actions-gap is the one spacing inside the group
  // (and, in the narrow layouts below, also after the count).
  --actions-gap: 8px
  justify-content: space-between
  gap: var(--actions-gap)
  padding: 0 10px
  overflow: hidden

  // Compact, so a 4-digit count + the AI icon + "Continue" + x still fit the ~372px aside column
  // (with the setup-wide 36px count and large buttons the x was pushed off the screen).
  ::v-deep .tile-pack-size
    flex: 0 0 auto

    .v-icon, .size
      font-size: 28px !important

  // no tile count (bookmarks / variant tabs): the actions at the right edge
  &.no-pack
    justify-content: flex-end

  .tiles-header-actions
    display: flex
    align-items: center
    gap: var(--actions-gap)
    white-space: nowrap

    // the items' own outer spacing would make the gaps uneven: the setup message is an empty box
    // when it has nothing to say (still a flex item, so an extra gap), the Next button wrapper
    // pads its right side, the message text has a right margin
    ::v-deep .header-message:empty
      display: none

    ::v-deep .header-message .warning-text, ::v-deep .header-message .info-text
      margin-right: 0

    ::v-deep .header-game-button
      padding-right: 0

    ::v-deep .v-btn
      margin-left: 0

    // regular-size buttons here (HeaderGameButton / HeaderLeaveGameButton ask for large ones)
    ::v-deep .v-btn.v-size--large
      height: 36px
      font-size: 0.875rem
      padding: 0 10px

    // the Leave (x) button: just the icon, so a narrow square
    ::v-deep .header-leavegame-button .v-btn
      min-width: 40px
      padding: 0

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
    // stacked, the page scrolls as a whole again
    height: auto
    // ONE header row on top — the tabs on the left, the tile count + warnings + Next / Create +
    // Leave on the right (the auto column) — then main and the aside full width under it.
    // minmax(0, ...): a bare 1fr track never shrinks below its widest content, which would push
    // the page into horizontal scroll instead of main/aside scrolling themselves.
    grid-template-columns: minmax(0, 1fr) auto
    grid-template-rows: var(--game-setup-header-height) auto auto
    grid-template-areas: "header tiles-header" "main main" "detail detail"

    // no aside (bookmarks / variant tabs) — the "no-detail" areas above are more specific than
    // this rule, so they are restated here
    &.no-detail
      grid-template-rows: var(--game-setup-header-height) auto
      grid-template-areas: "header tiles-header" "main main"

    .tiles-header
      top: 0
      padding-left: 0

      // count and actions packed together in their own column, one gap between every item
      --actions-gap: 14px
      justify-content: flex-start
      padding: 0 12px 0 0

  main
    margin-right: 0

// too narrow for one row: the tiles header becomes a second row, its content one centred group
@media (max-width: 780px)
  .game-setup-grid
    // the tile count + actions on top, the tabs as the second line
    grid-template-columns: minmax(0, 1fr)
    grid-template-rows: var(--game-setup-header-height) var(--game-setup-header-height) auto auto
    grid-template-areas: "tiles-header" "header" "main" "detail"

    &.no-detail
      grid-template-rows: var(--game-setup-header-height) var(--game-setup-header-height) auto
      grid-template-areas: "tiles-header" "header" "main"

    // both rows centred (the tabs inside Vuetify's full-width tab bar too), both pinned on top
    .primary-header
      top: var(--game-setup-header-height)
      justify-content: center

      ::v-deep .v-tabs-bar__content
        justify-content: center

    .tiles-header
      top: 0
      justify-content: center
      padding: 0

@media (max-height: 768px)
  .game-setup-grid
    ::v-deep .tile-pack-size
      .v-icon, .size
        font-size: 28px !important
</style>
