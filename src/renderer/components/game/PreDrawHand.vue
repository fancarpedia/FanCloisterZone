<template>
  <div v-if="active" class="predraw-hand" :style="positionStyle">
    <div class="title" @mousedown="startDrag">
      <v-icon class="drag-handle">fas fa-arrows-alt-h</v-icon>{{ $t('predraw.your-hand') }}
    </div>
    <div class="tiles">
      <template v-for="(tileId, i) in myHand">
        <!-- The picked tile becomes a live placement: same supply mechanism as abbey/bazaar
             (TilePlacementItem), but it reveals + validates via PLACE_PREDRAWN. Selection is by hand
             INDEX (not tileId) so duplicate tiles in hand don't both activate. -->
        <TilePlacementItem
          v-if="canPlace && selected && selected.index === i"
          :key="'sel' + i"
          :tile-id="tileId"
          :options="selected.options"
          active
          :local="true"
          place-message-type="PLACE_PREDRAWN"
          class="tile selected"
        />
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
      <div v-if="!myHand.length" class="empty">{{ $t('predraw.empty') }}</div>
    </div>
    <button
      v-if="canDraw"
      class="draw-btn"
      @click="drawTile"
    >{{ $t('predraw.draw') }} ({{ myHand.length }}/{{ effectiveMax }})</button>
    <button
      v-else-if="canPassAbbey"
      class="draw-btn"
      @click="passAbbey"
    >{{ $t('predraw.pass-abbey') }}</button>
    <div v-if="canPlace && myHand.length" class="hint">{{ $t('predraw.pick-hint') }}</div>
    <div v-if="otherCounts.length" class="counts">
      <span v-for="c in otherCounts" :key="c.seat">P{{ c.seat + 1 }}: {{ c.count }}</span>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import StandaloneTileImage from '@/components/game/StandaloneTileImage.vue'
import TilePlacementItem from '@/components/game/actions/items/TilePlacementItem.vue'

export default {
  components: { StandaloneTileImage, TilePlacementItem },

  data () {
    return {
      dragging: false,
      dragOffset: 0,
      dragWidth: 0,
      // anchored to the window bottom (locked) — only `left` moves; persisted in settings.
      position: { left: 12, bottom: 12 }
    }
  },

  computed: {
    ...mapState('predraw', ['myHand', 'counts', 'selected', 'handMax', 'abbeyPassed', 'mySeat']),
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
    // True while we hold an (unplaced) abbey tile — it reserves one pre-draw slot until passed.
    abbeyHeld () {
      if (!this.myTurn) return false
      const { action, players } = this.$store.state.game
      const p = action && players ? players[action.player] : null
      return !!(p && p.tokens && p.tokens.ABBEY_TILE && p.tokens.ABBEY_TILE.count > 0)
    },
    // Bazaar in play reserves one pre-draw slot (mirrors the server) → base cap N-1.
    bazaarInPlay () {
      const els = this.$store.state.game.setup && this.$store.state.game.setup.elements
      return !!(els && els.bazaar)
    },
    // Pre-draw cap right now: N, minus 1 if bazaar is in play, minus 1 more while an unpassed abbey is held.
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
    otherCounts () {
      return Object.keys(this.counts).map(seat => ({ seat: +seat, count: this.counts[seat] }))
    }
  },

  watch: {
    myTurn (val) {
      if (!val) {
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
  },

  beforeDestroy () {
    window.removeEventListener('resize', this.clampPosition)
    document.removeEventListener('mousemove', this.onDrag)
    document.removeEventListener('mouseup', this.stopDrag)
  },

  methods: {
    drawTile () {
      this.$store.dispatch('predraw/requestPreDraw')
    },

    passAbbey () {
      this.$store.dispatch('predraw/passAbbey')
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

  .title
    opacity: 0.8
    margin-bottom: 4px
    cursor: move

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

    .tile.selected
      outline: 2px solid #ffd54f

    .empty
      opacity: 0.6

  .draw-btn
    margin-top: 6px
    padding: 4px 12px
    border-radius: 4px
    background: #ffd54f
    color: #222
    font-weight: 600
    cursor: pointer

  .hint
    margin-top: 6px
    opacity: 0.7

  .counts
    margin-top: 6px
    display: flex
    gap: 10px
    opacity: 0.85
</style>
