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
      :tile-id="tilePlacement.tileId"
      :options="tilePlacement.options"
      :active="!preDrawSelected"
      :local="local"
    />
    <slot :label="phase === 'TileFromSupplyPhase' ? $t('game.action.draw-a-tile') : null" />
  </section>
</template>

<script>
import TilePlacementItem from '@/components/game/actions/items/TilePlacementItem.vue'

export default {
  components: {
    TilePlacementItem
  },

  props: {
    action: { type: Object, required: true },
    phase: { type: String, required: true },
    local: { type: Boolean }
  },

  computed: {
    tilePlacement () {
      const item = this.action.items.find(i => i.type === 'TilePlacement') || null
      // Pre-draw: once the abbey is passed this turn, the player declined it — don't offer it for
      // placement (the server also refuses a PLACE_TILE for it). 'AM/A' is the engine's abbey tile id.
      if (item && item.tileId === 'AM/A' && this.$store.state.predraw.abbeyPassed) return null
      return item
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
</style>
