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
    <!-- several supply tiles at once (abbey + Kingdom Palace, bazaar tile + …): the others wait as
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
    <!-- Pre-draw: the engine allows no pass here (tiles come from the secret hand), so skipping the
         offered supply tile(s) is the server's pass — it deals the held-back tile, and the passed
         abbey / palace leaves this panel. Outside pre-draw the regular pass button below does it. -->
    <div v-if="showSkip" class="pass-item">
      <ActionButton
        :large="$vuetify.breakpoint.height > 768"
        color="secondary"
        icon="fa-forward"
        :label="$t('game.action.skip-action')"
        @click="skipSupply"
      />
    </div>
    <slot :label="phase === 'TileFromSupplyPhase' ? $t('game.action.draw-a-tile') : null" />
  </section>
</template>

<script>
import TilePlacementItem from '@/components/game/actions/items/TilePlacementItem.vue'
import ActionButton from '@/components/game/actions/ActionButton'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import { isKingdomPalace } from '@/utils/kingdom-palace'

export default {
  components: {
    ActionButton,
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
      // Kingdom Palace, which pre-draw treats the same) for placement; the server also refuses a
      // PLACE_TILE for it. 'AM/A' is the engine's abbey tile id.
      const passed = this.$store.state.predraw.abbeyPassed
      return this.action.items.filter(i => i.type === 'TilePlacement' &&
        !(passed && (i.tileId === 'AM/A' || isKingdomPalace(i.tileId))))
    },
    tilePlacement () {
      return this.placements.find(i => i.tileId === this.selectedTileId) || this.placements[0] || null
    },
    otherPlacements () {
      return this.placements.filter(i => i !== this.tilePlacement)
    },
    // Skip, in a pre-draw game, when at least one supply tile (abbey / Kingdom Palace) is offered and
    // the engine itself allows no pass
    showSkip () {
      if (!this.local || this.phase !== 'TileFromSupplyPhase' || this.action.canPass) return false
      const els = this.$store.state.game.setup && this.$store.state.game.setup.elements
      if (!(els && els['pre-draw'])) return false
      return this.placements.some(i => i.tileId === 'AM/A' || isKingdomPalace(i.tileId))
    },
    // When the player has picked a pre-draw tile to place, let it own the board ghost.
    preDrawSelected () {
      return !!this.$store.state.predraw.selected
    }
  },

  methods: {
    skipSupply () {
      this.$store.dispatch('predraw/passAbbey')
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
