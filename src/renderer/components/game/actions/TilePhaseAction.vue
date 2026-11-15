<template>
  <section>
    <span v-if="phase === 'TileFromSupplyPhase'" class="text">
      {{ local ? $t('game.action.you-may-place-a-tile-from-supply') : $t('game.action.player-may-place-a-tile-from-supply') }}
    </span>
    <span v-else class="text">
      {{ local ? $t('game.action.place-the-tile') : $t('game.action.player-must-place-the-tile') }}
    </span>
    <!-- A real supply tile (abbey / bazaar). A pre-draw tile is NOT here — its action is opaque
         (the engine can't see the secret hand); it is placed from the hand tray (PreDrawHand.vue).
         While the player has picked a pre-draw tile to place, this (abbey) ghost yields the board so
         only one placement ghost is active at a time. -->
    <TilePlacementItem
      v-if="tilePlacement"
      :key="tilePlacement.tileId"
      :tile-id="tilePlacement.tileId"
      :options="tilePlacement.options"
      :active="!preDrawSelected"
      :local="local"
    />
    <!-- several supply tiles at once (abbey + City Palace, bazaar tile + …): the others wait as
         thumbnails; clicking one makes it the tile placed on the board -->
    <StandaloneTileImage
      v-for="alt in otherPlacements"
      :key="'alt-' + alt.tileId"
      class="alt-tile"
      :class="{ remote: !local }"
      :tile-id="alt.tileId"
      :size="40"
      :title="$t('game.action.place-this-tile-instead')"
      @click="local && (selectedTileId = alt.tileId)"
    />
    <slot :label="phase === 'TileFromSupplyPhase' ? $t('game.action.draw-a-tile') : null" />
  </section>
</template>

<script>
import TilePlacementItem from '@/components/game/actions/items/TilePlacementItem.vue'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import { isCityPalace } from '@/utils/city-palace'

export default {
  components: {
    StandaloneTileImage,
    TilePlacementItem
  },

  props: {
    action: { type: Object, required: true },
    phase: { type: String, required: true },
    local: { type: Boolean }
  },

  data () {
    return {
      selectedTileId: null
    }
  },

  computed: {
    placements () {
      // Pre-draw: once the abbey is passed this turn, the player declined it — don't offer it (nor a
      // City Palace, which pre-draw treats the same) for placement; the server also refuses a
      // PLACE_TILE for it. 'AM/A' is the engine's abbey tile id.
      const passed = this.$store.state.predraw.abbeyPassed
      return this.action.items.filter(i => i.type === 'TilePlacement' &&
        !(passed && (i.tileId === 'AM/A' || isCityPalace(i.tileId))))
    },
    tilePlacement () {
      return this.placements.find(i => i.tileId === this.selectedTileId) || this.placements[0] || null
    },
    otherPlacements () {
      return this.placements.filter(i => i !== this.tilePlacement)
    },
    // When the player has picked a pre-draw tile to place, let it own the board ghost.
    preDrawSelected () {
      return !!this.$store.state.predraw.selected
    }
  }
}
</script>

<style lang="sass" scoped>
.text
  font-size: 20px
  font-weight: 300

.alt-tile
  cursor: pointer
  opacity: 0.75
  align-self: center

  &:hover
    opacity: 1

  &.remote
    cursor: default
</style>
