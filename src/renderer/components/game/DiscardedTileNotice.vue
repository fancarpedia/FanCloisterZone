<template>
  <!-- A drawn tile that fits nowhere on the board is discarded and a new one drawn. Without this
       the players saw only a crossed-out tile in the history: tell everyone, with the tile. -->
  <v-snackbar
    v-model="shown"
    top
    :timeout="6000"
    class="discarded-tile-notice"
  >
    <div class="notice-body">
      <div class="notice-tiles">
        <StandaloneTileImage
          v-for="(id, i) in tiles"
          :key="i"
          :tile-id="id"
          :size="tileSize"
        />
      </div>
      <span class="notice-text">{{ $tc('game.action.tile-discarded-notice-plural', tiles.length) }}</span>
    </div>
    <template #action="{ attrs }">
      <v-btn icon v-bind="attrs" @click="shown = false">
        <v-icon>fas fa-times</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import { mapState } from 'vuex'

import StandaloneTileImage from '@/components/game/StandaloneTileImage'

// The tiles newly added to the discarded list, or [] when nothing was discarded by play: no list
// before (a game just loaded / started — its earlier discards are history, not news) or a shorter
// one (an undo).
export const newlyDiscarded = (value, old) => {
  if (!Array.isArray(value) || !Array.isArray(old)) return []
  return value.length > old.length ? value.slice(old.length) : []
}

export default {
  components: {
    StandaloneTileImage
  },

  data () {
    return {
      shown: false,
      tiles: []
    }
  },

  computed: {
    ...mapState({
      discardedTiles: state => state.game.discardedTiles
    }),

    // small screens (≤ 960px, as elsewhere in the game screen) get a smaller tile
    tileSize () {
      return this.$vuetify.breakpoint.width <= 960 ? 112 : 168
    }
  },

  watch: {
    discardedTiles (value, old) {
      const added = newlyDiscarded(value, old)
      if (!added.length) return
      this.tiles = added
      this.shown = true
    }
  }
}
</script>

<style lang="sass" scoped>
// just below the action panel (which runs along the top), not over it
.discarded-tile-notice
  top: calc(var(--action-panel-height, 84px) + 8px)

// large enough to be noticed: a big tile and big text
.discarded-tile-notice ::v-deep .v-snack__wrapper
  min-width: 420px
  max-width: calc(100vw - 32px)

.discarded-tile-notice ::v-deep .v-snack__content
  padding: 14px 18px

// the close button in the top-right corner, out of the way of the tile and the text
.discarded-tile-notice ::v-deep .v-snack__wrapper
  position: relative

.discarded-tile-notice ::v-deep .v-snack__action
  position: absolute
  top: 4px
  right: 4px
  margin: 0

// dark theme: a light grey notice with dark text, so it stands out on the dark board (the
// default dark snackbar sinks into it). The browser's automatic dark mode gets the same look
// from player-colors.scss.
#app.theme--dark .discarded-tile-notice ::v-deep .v-snack__wrapper
  background-color: #e0e0e0 !important
  color: #212121 !important

  .v-icon
    color: #212121 !important

// the tile(s) on top, the text below them, centred
.notice-body
  display: flex
  flex-direction: column
  align-items: center
  gap: 12px
  font-size: 24px
  font-weight: 500
  line-height: 1.3
  text-align: center

.notice-tiles
  display: flex
  flex-wrap: wrap
  justify-content: center
  gap: 12px

  ::v-deep .standalone-tile-image, ::v-deep svg
    flex: 0 0 auto

// small screens: fits a phone — no minimum width, smaller text and padding (tile: tileSize)
@media (max-width: $small-screen-max-width)
  .discarded-tile-notice ::v-deep .v-snack__wrapper
    min-width: 0
    max-width: calc(100vw - 16px)

  .discarded-tile-notice ::v-deep .v-snack__content
    padding: 10px 12px

  .notice-body
    gap: 8px
    font-size: 19px

  .notice-tiles
    gap: 8px
</style>
