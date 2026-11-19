<template>
  <section>
    <!-- the supply wording only while a supply tile is actually offered (and no hand tile picked):
         once a pre-draw player passed it (drew the last tile), it is a plain "place the tile" -->
    <span v-if="phase === 'TileFromSupplyPhase' && placements.length && !preDrawTile" class="text">
      {{ local ? $t('game.action.you-may-place-a-tile-from-supply') : $t('game.action.player-may-place-a-tile-from-supply') }}
    </span>
    <!-- pre-draw, no tile in the panel yet (nothing picked from the hand, no supply tile offered):
         the player first chooses a tile from their hand -->
    <span v-else-if="phase === 'TileFromSupplyPhase' && !preDrawTile && !tilePlacement" class="text">
      {{ local ? $t('game.action.choose-a-tile-from-your-hand') : $t('game.action.player-is-choosing-a-tile') }}
    </span>
    <span v-else class="text">
      {{ local ? $t('game.action.place-the-tile') : $t('game.action.player-must-place-the-tile') }}
    </span>
    <!-- Pre-draw: the tile picked from the secret hand (PreDrawHand.vue) is shown and placed HERE,
         like a drawn tile — click it (or right-click the board) to turn it. It reveals + validates
         through PLACE_PREDRAWN. Keyed by hand index, so picking another tile starts fresh. -->
    <TilePlacementItem
      v-if="preDrawTile"
      :key="'predraw-' + preDrawTile.index"
      :tile-id="preDrawTile.tileId"
      :options="preDrawTile.options"
      active
      :local="true"
      place-message-type="PLACE_PREDRAWN"
    />
    <!-- The supply tiles (abbey / Kingdom Palace / bazaar …) in a FIXED order: the chosen one is the
         live placement (marked with a border when there is a choice), the others wait as thumbnails
         in their own places — choosing one doesn't reorder them. While a hand tile is picked, all
         of them are thumbnails. -->
    <template v-for="pl in placements">
      <TilePlacementItem
        v-if="!preDrawTile && pl === tilePlacement"
        :key="pl.tileId"
        :tile-id="pl.tileId"
        :options="pl.options"
        active
        :local="local"
        :class="{ chosen: placements.length > 1 }"
      />
      <StandaloneTileImage
        v-else
        :key="'alt-' + pl.tileId"
        class="alt-tile"
        :class="{ remote: !local }"
        :tile-id="pl.tileId"
        :size="40"
        :title="$t('game.action.place-this-tile-instead')"
        @click="local && chooseSupplyTile(pl.tileId)"
      />
    </template>
    <!-- Pre-draw: the engine allows no pass here (tiles come from the secret hand), so skipping the
         offered supply tile(s) is the server's pass — it deals the held-back tile, and the passed
         abbey / palace leaves this panel. Outside pre-draw the regular pass button below does it. -->
    <div v-if="showSkip" class="pass-item">
      <ActionButton
        :large="$vuetify.breakpoint.height > 768"
        color="secondary"
        icon="fa-forward"
        :label="$t('game.action.draw-a-tile')"
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
    // Skip, in a pre-draw game, when at least one supply tile (abbey / Kingdom Palace) is offered and
    // the engine itself allows no pass
    showSkip () {
      if (!this.local || this.phase !== 'TileFromSupplyPhase' || this.action.canPass) return false
      const els = this.$store.state.game.setup && this.$store.state.game.setup.elements
      if (!(els && els['pre-draw'])) return false
      return this.placements.some(i => i.tileId === 'AM/A' || isKingdomPalace(i.tileId))
    },
    // the tile the local player picked from the pre-draw hand — placed from this panel
    preDrawTile () {
      return this.local ? this.$store.state.predraw.selected : null
    }
  },

  mounted () {
    window.addEventListener('keydown', this.onKeyDown)
    // a supply tile clicked in the pre-draw hand (PreDrawHand.vue) — place that one
    this.$root.$on('tile-from-supply.choose', this.onChooseFromHand)
  },

  beforeDestroy () {
    window.removeEventListener('keydown', this.onKeyDown)
    this.$root.$off('tile-from-supply.choose', this.onChooseFromHand)
  },

  methods: {
    // a supply tile thumbnail was clicked: it becomes the tile placed (a picked hand tile is dropped)
    chooseSupplyTile (tileId) {
      if (this.preDrawTile) this.$store.dispatch('predraw/clearSelection')
      this.selectedTileId = tileId
    },

    onChooseFromHand (tileId) {
      if (this.local && this.placements.some(i => i.tileId === tileId)) this.chooseSupplyTile(tileId)
    },

    skipSupply () {
      this.$store.dispatch('predraw/passAbbey')
    },

    // Space = Skip, like Space = Pass elsewhere (ActionPanel.onKeyDown handles the engine's own pass;
    // the pre-draw Skip is not an engine pass, so it needs its own key)
    onKeyDown (ev) {
      if (ev.key === ' ' && this.showSkip && !this.$store.state.gameDialog && !this.$store.state.gameChatEdit) {
        ev.preventDefault()
        this.skipSupply()
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.text
  font-size: 20px
  font-weight: 300

// the chosen supply tile, when there are several to choose from. Same box and spacing as the
// others (the placement tile's own 30px side margins dropped), so switching doesn't shift the row.
.chosen
  outline: 3px solid #ffd54f
  outline-offset: 2px
  border-radius: 2px
  margin: 0 10px

.alt-tile
  margin: 0 10px
  cursor: pointer
  opacity: 0.75
  align-self: center

  &:hover
    opacity: 1

  &.remote
    cursor: default
</style>
