<template>
  <div v-if="active" class="predraw-hand" :style="positionStyle">
    <div class="title" @mousedown="startDrag">
      <v-icon class="drag-handle">fas fa-arrows-alt-h</v-icon>{{ $t('predraw.your-hand') }}
    </div>
    <div class="tiles">
      <template v-for="(tileId, i) in myHand">
        <!-- The picked tile is placed from the action panel (TilePhaseAction shows it there as the
             live TilePlacementItem, like a drawn tile). Here it stays highlighted with the rotate
             symbol: clicking it again turns the panel tile (the same 'rclick' the board uses). -->
        <div
          v-if="canPlace && selected && selected.index === i"
          :key="'sel' + i"
          class="selected-wrap"
        >
          <StandaloneTileImage
            :tile-id="tileId"
            :size="60"
            class="tile selected"
            @click.native="rotateSelected"
          />
          <v-icon class="rotate-icon">fas fa-sync-alt</v-icon>
        </div>
        <StandaloneTileImage
          v-else
          :key="i"
          :tile-id="tileId"
          :size="60"
          class="tile"
          :class="{ selectable: canPlace }"
          @click.native="onTileClick(i, tileId)"
        />
      </template>
      <!-- the free places of the hand stay as empty slots, so the panel keeps its size (and the
           tiles their places) when a tile is placed, until the next one is drawn -->
      <!-- The first free slot is the draw button: clicking it draws a tile into it. When the last
           slot is held back for a supply tile (abbey / Kingdom Palace), the click passes that tile
           this turn and so draws the held-back one (the tooltip says so). -->
      <div
        v-for="n in emptySlots"
        :key="'empty' + n"
        class="tile empty-slot"
        :class="{ drawable: n === 1 && slotAction }"
        :title="n === 1 && slotAction ? slotTitle : (deckEmpty ? $t('predraw.no-tiles-left') : null)"
        @click="n === 1 && onDrawSlot()"
      >
        <v-icon v-if="n === 1 && slotAction" class="draw-icon">fas fa-plus</v-icon>
        <!-- the deck is empty: this slot will never be refilled -->
        <v-icon v-else-if="deckEmpty" class="never-icon">fas fa-ban</v-icon>
        <!-- not drawable now (another player's turn, or later in ours): the slot waits to be refilled -->
        <v-icon v-else class="wait-icon">fas fa-hourglass-half</v-icon>
      </div>
      <div v-if="!myHand.length && !emptySlots" class="empty">{{ $t('predraw.empty') }}</div>
      <!-- the player's supply (abbey / Kingdom Palace), after a divider: a supply tile offered for
           placement right now is clickable and becomes the tile placed from the action panel -->
      <template v-if="supplyTiles.length">
        <div class="supply-divider" />
        <StandaloneTileImage
          v-for="(t, si) in supplyTiles"
          :key="'supply' + si"
          :tile-id="t.tileId"
          :size="60"
          class="tile supply-tile"
          :class="{ selectable: t.offered, unavailable: !t.offered }"
          @click.native="t.offered && chooseSupplyTile(t.tileId)"
        />
      </template>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import StandaloneTileImage from '@/components/game/StandaloneTileImage.vue'
import { isKingdomPalace, kingdomPalaceTileId } from '@/utils/kingdom-palace'

export default {
  components: { StandaloneTileImage },

  data () {
    return {
      dragging: false,
      dragOffset: 0,
      dragWidth: 0,
      // anchored to the window bottom (locked) — only `left` moves; persisted in settings.
      position: { left: 12, bottom: 12 },
      // the automatic pass (see autoPassDue) was already sent this turn-part
      autoPassSent: false
    }
  },

  computed: {
    ...mapState('predraw', ['myHand', 'counts', 'selected', 'handMax', 'abbeyPassed', 'mySeat', 'deckEmpty']),
    positionStyle () {
      return { left: this.position.left + 'px', bottom: this.position.bottom + 'px' }
    },
    // Show only when the pre-draw variant is active (setup flag) or any activity has happened.
    active () {
      const game = this.$store.state.game
      const els = game && game.setup ? game.setup.elements : null
      return !!(els && els['pre-draw']) || this.myHand.length > 0 || Object.keys(this.counts).length > 0
    },
    // Our pre-draw turn-part.
    myTurn () {
      return this.$store.getters['game/isActionLocal'] && this.$store.state.game.phase === 'TileFromSupplyPhase'
    },
    // True while we hold an (unplaced) abbey or Kingdom Palace (Kingdoms) tile — it reserves one
    // pre-draw slot until passed (the server counts both the same way).
    abbeyHeld () {
      if (!this.myTurn) return false
      const { action, players } = this.$store.state.game
      const p = action && players ? players[action.player] : null
      const held = token => !!(p && p.tokens && p.tokens[token] && p.tokens[token].count > 0)
      return held('ABBEY_TILE') || held('KINGDOM_PALACE')
    },
    // Bazaar in play reserves one pre-draw slot (mirrors the server) → base cap N-1.
    bazaarInPlay () {
      const els = this.$store.state.game.setup && this.$store.state.game.setup.elements
      return !!(els && els.bazaar)
    },
    // Pre-draw cap right now: N, minus 1 if bazaar is in play, minus 1 more while an unpassed abbey is held.
    // free places in the hand (its full size minus the tiles held), drawn as empty slots; before
    // the hand size is known (handMax 0) one slot still stands for the draw button
    emptySlots () {
      if (this.handMax <= 0) return this.canDraw ? 1 : 0
      return Math.max(0, this.handMax - this.myHand.length)
    },
    // what clicking the first free slot does: draw, or pass the held supply tile (which deals the
    // held-back tile into that slot); null = the slot is just empty
    slotAction () {
      if (this.deckEmpty) return null // nothing left to draw — neither a draw nor a pass brings a tile
      if (this.canDraw) return 'draw'
      if (this.canPassAbbey) return 'pass'
      return null
    },
    slotTitle () {
      // one wording for every supply tile (abbey, Kingdom Palace, …)
      if (this.slotAction === 'pass') return this.$t('predraw.pass-tile-from-supply')
      return `${this.$t('predraw.draw')} (${this.myHand.length}/${this.effectiveMax})`
    },
    effectiveMax () {
      if (this.handMax <= 0) return 0
      const base = Math.max(0, this.handMax - (this.bazaarInPlay ? 1 : 0))
      return (this.abbeyHeld && !this.abbeyPassed) ? Math.max(0, base - 1) : base
    },
    // Placing a held pre-draw tile is allowed any time it's our turn — the player may place the abbey
    // OR any pre-draw tile. Selecting a pre-draw tile takes the board ghost over from the abbey (the
    // abbey's ActionPanel item deactivates while `predraw.selected` is set), so only one ghost shows.
    canPlace () {
      return this.myTurn
    },
    // Draw while it's our turn and the hand is below the effective cap. If handMax isn't seeded yet
    // (0), still offer it — the server enforces the real cap and rejects surplus harmlessly.
    canDraw () {
      if (!this.myTurn) return false
      return this.handMax <= 0 || this.myHand.length < this.effectiveMax
    },
    // Once the N-1 draws are used, "pass abbey" declines the abbey this turn and releases the final
    // draw (server raises the cap to N and deals the held-back tile).
    canPassAbbey () {
      return this.myTurn && this.abbeyHeld && !this.abbeyPassed && (this.handMax <= 0 || this.myHand.length < this.handMax)
    },
    // Is any held supply tile (abbey / Kingdom Palace) placeable right now? The engine offers a supply
    // tile as a TilePlacement only when it has a legal spot (a hole for the abbey, an own-occupied
    // city without a palace for a palace).
    supplyPlaceable () {
      const action = this.$store.state.game.action
      return !!(action && (action.items || []).some(i =>
        i.type === 'TilePlacement' && (i.tileId === 'AM/A' || isKingdomPalace(i.tileId))))
    },
    // Our turn, nothing picked from the hand and no supply tile to place now (none held, none with a
    // legal spot, or passed this turn): the hand is the only choice, so its first tile is picked
    // automatically (shown in the action panel, ready to place). Another hand tile can still be picked.
    autoSelectDue () {
      if (!this.canPlace || this.selected || !this.myHand.length) return false
      const action = this.$store.state.game.action
      const supplyOffered = !!(action && (action.items || []).some(i => i.type === 'TilePlacement' &&
        !(this.abbeyPassed && (i.tileId === 'AM/A' || isKingdomPalace(i.tileId)))))
      return !supplyOffered
    },
    // Holding supply tile(s) that cannot be placed anywhere this turn keeps the last pre-draw slot
    // reserved for nothing — so pass automatically: the server then deals the held-back tile
    // (exactly the "Pass … (draw last tile)" button, which would be the only sensible choice).
    autoPassDue () {
      return this.canPassAbbey && !this.supplyPlaceable
    },
    // the local player's supply tiles (abbey tiles, Kingdom Palaces), always shown; each marked
    // whether it can be placed right now — not once passed this turn (also the automatic pass when a
    // hand tile is placed instead), which only leaves the action panel and dims it here
    supplyTiles () {
      const { players, action } = this.$store.state.game
      const me = this.mySeat === null || !players ? null : players[this.mySeat]
      if (!me || !me.tokens) return []
      const offered = new Set(this.canPlace && action
        ? (action.items || []).filter(i => i.type === 'TilePlacement').map(i => i.tileId)
        : [])
      const tiles = []
      const add = (tileId, count) => {
        for (let k = 0; k < count; k++) tiles.push({ tileId, offered: offered.has(tileId) && !this.abbeyPassed })
      }
      add('AM/A', me.tokens.ABBEY_TILE?.count || 0)
      // the palace the engine dealt this player (its token names the tile), else their colour's one
      const palace = me.tokens.KINGDOM_PALACE?.tile || kingdomPalaceTileId(me.slot)
      if (palace) add(palace, me.tokens.KINGDOM_PALACE?.count || 0)
      return tiles
    }
  },

  watch: {
    autoSelectDue: {
      immediate: true,
      handler (due) {
        if (due) this.$store.dispatch('predraw/selectForPlacement', { index: 0, tileId: this.myHand[0] })
      }
    },

    autoPassDue: {
      immediate: true,
      handler (due) {
        if (due && !this.autoPassSent) {
          this.autoPassSent = true
          this.passAbbey()
        }
      }
    },

    myTurn (val) {
      if (!val) {
        this.autoPassSent = false
        // Leaving our turn-part: cancel any pending selection + re-arm the abbey pass for next turn.
        if (this.selected) this.$store.dispatch('predraw/clearSelection')
        if (this.abbeyPassed) this.$store.commit('predraw/setAbbeyPassed', false)
      }
    }
  },

  mounted () {
    const saved = this.$store.state.settings.preDrawHandPosition
    if (saved && typeof saved.left === 'number') {
      this.position.left = saved.left
      if (typeof saved.bottom === 'number') this.position.bottom = saved.bottom
    }
    this.$nextTick(this.clampPosition)
    window.addEventListener('resize', this.clampPosition)
    this.$nextTick(this.publishRect)
  },

  // the box changes size (tiles drawn / placed, supply shown) — keep its published place current
  updated () {
    this.publishRect()
  },

  beforeDestroy () {
    this.$store.commit('predraw/setHandRect', null)
    window.removeEventListener('resize', this.clampPosition)
    document.removeEventListener('mousemove', this.onDrag)
    document.removeEventListener('mouseup', this.stopDrag)
  },

  methods: {
    // the first free slot was clicked: draw into it, or pass the held supply tile to get the last one
    onDrawSlot () {
      if (this.slotAction === 'draw') this.drawTile()
      else if (this.slotAction === 'pass') this.passAbbey()
    },
    drawTile () {
      this.$store.dispatch('predraw/requestPreDraw')
    },

    passAbbey () {
      this.$store.dispatch('predraw/passAbbey')
    },

    // a supply tile was clicked: the action panel (TilePhaseAction) makes it the tile placed
    chooseSupplyTile (tileId) {
      this.$root.$emit('tile-from-supply.choose', tileId)
    },

    // turn the picked tile: its TilePlacementItem (in the action panel) rotates on 'rclick'
    rotateSelected () {
      this.$root.$emit('rclick')
    },

    onTileClick (index, tileId) {
      if (!this.canPlace) return
      // Re-clicking the picked tile cancels it; otherwise pick it (by hand index) + fetch placements.
      if (this.selected && this.selected.index === index) {
        this.$store.dispatch('predraw/clearSelection')
      } else {
        this.$store.dispatch('predraw/selectForPlacement', { index, tileId })
      }
    },

    // ---- drag (locked to the window bottom: only horizontal movement) ----
    startDrag (ev) {
      this.dragging = true
      this.dragWidth = this.$el ? this.$el.offsetWidth : 0
      this.dragOffset = ev.clientX - this.position.left
      document.addEventListener('mousemove', this.onDrag)
      document.addEventListener('mouseup', this.stopDrag)
      ev.preventDefault()
    },

    onDrag (ev) {
      if (!this.dragging) return
      const margin = 8
      const maxLeft = Math.max(margin, window.innerWidth - this.dragWidth - margin)
      this.position.left = Math.min(Math.max(ev.clientX - this.dragOffset, margin), maxLeft)
      this.$nextTick(this.publishRect)
    },

    stopDrag () {
      if (!this.dragging) return
      this.dragging = false
      document.removeEventListener('mousemove', this.onDrag)
      document.removeEventListener('mouseup', this.stopDrag)
      this.$store.dispatch('settings/update', {
        preDrawHandPosition: { left: this.position.left, bottom: this.position.bottom }
      })
    },

    // keep the panel inside the window (e.g. after a resize)
    clampPosition () {
      const margin = 8
      const width = this.$el ? this.$el.offsetWidth : 0
      const maxLeft = Math.max(margin, window.innerWidth - width - margin)
      this.position.left = Math.min(Math.max(this.position.left, margin), maxLeft)
      this.$nextTick(this.publishRect)
    },

    // Where the box is on screen, for the chat launchers (ChatBulletDragMixin): one it would cover
    // steps aside to the other side of the box. Published only when it actually changed.
    publishRect () {
      const el = this.$el
      const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null
      const rect = r && r.width ? { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) } : null
      const cur = this.$store.state.predraw.handRect
      if (JSON.stringify(cur) !== JSON.stringify(rect)) this.$store.commit('predraw/setHandRect', rect)
    }
  }
}
</script>

<style lang="sass" scoped>
.predraw-hand
  position: absolute
  z-index: 5
  padding: 8px 10px
  border-radius: 8px
  background: rgba(0, 0, 0, 0.55)
  color: #fff
  font-size: 12px
  user-select: none
  // as wide as the row of tile slots (which never wraps)
  width: min-content
  min-width: 140px

  .title
    opacity: 0.8
    margin-bottom: 4px
    cursor: move
    white-space: nowrap

    .drag-handle
      font-size: 12px
      color: #fff
      opacity: 0.7
      margin-right: 6px

  .tiles
    display: flex
    gap: 6px
    min-height: 60px
    align-items: center

    .tile
      border-radius: 4px

    .tile.selectable
      cursor: pointer

    // the supply: a thin divider, then the supply tiles (dimmed while not placeable)
    .supply-divider
      align-self: stretch
      width: 1px
      margin: 0 2px
      background: rgba(255, 255, 255, 0.35)

    .tile.supply-tile.unavailable
      opacity: 0.5

    // the picked tile keeps its slot like every other tile, so the row doesn't jump on selection
    .tile.selected
      outline: 2px solid #ffd54f
      margin: 0
      cursor: pointer
      display: block

    // the rotate symbol sits on the picked tile; clicks pass through to the tile (which rotates)
    .selected-wrap
      position: relative
      line-height: 0

      .rotate-icon
        position: absolute
        right: 3px
        bottom: 3px
        font-size: 16px
        color: white
        filter: drop-shadow(0 0 1px black) drop-shadow(0 0 2px black)
        pointer-events: none

    // a free place of the hand, the size of a tile
    .tile.empty-slot
      width: 60px
      height: 60px
      box-sizing: border-box
      border: 2px dashed rgba(255, 255, 255, 0.35)
      display: flex
      align-items: center
      justify-content: center

      .wait-icon
        color: rgba(255, 255, 255, 0.35)
        font-size: 18px

      // the deck is empty: the slot stays free for good
      .never-icon
        color: rgba(255, 255, 255, 0.35)
        font-size: 18px

      // the slot that draws (the former Draw / Pass button): a dashed button with a plus
      &.drawable
        cursor: pointer
        border-color: #ffd54f
        background: rgba(255, 213, 79, 0.12)

        .draw-icon
          color: #ffd54f
          font-size: 20px

        &:hover
          background: rgba(255, 213, 79, 0.25)

    .empty
      opacity: 0.6

</style>
