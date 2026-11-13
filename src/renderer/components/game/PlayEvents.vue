<template>
  <div class="play-events" :class="{collapsed: !$store.state.showGameHistory}">
    <button
      class="history-toggle"
      :class="{ collapsed: !$store.state.showGameHistory }"
      :title="$store.state.showGameHistory ? $t('button.hide') : $t('button.show')"
      :style="{ top: `${toggleTop}px` }"
      @click="toggleGameHistory"
    >
      <v-icon small>fa-history</v-icon>
      <v-icon x-small>{{ $store.state.showGameHistory ? 'fa-chevron-left' : 'fa-chevron-right' }}</v-icon>
    </button>
    <!-- single scroll layer: only this element's transform changes while scrolling, so the
         browser composites instead of re-laying-out every row (smooth, no per-row "jumping") -->
    <div class="events-scroll" :style="{ transform: `translateY(${-offset}px)` }">
      <template v-if="phase === 'GameOverPhase'">
        <!-- final scoring "turn" strip - stays visible (like turn numbers) when history is collapsed -->
        <div
          class="number final-number"
          :style="{ top: `${baseY}px`, height: `${finalHeight}px`, 'clip-path': getClipPath(-offset + baseY, finalHeight) }"
          @click="toggleGameHistory"
        />
        <FinalScoringEvents :style="{ top: `${baseY}px`, 'clip-path': getClipPath(-offset + baseY, finalHeight) }" />
      </template>
      <div
        v-for="h in reversed"
        :key="h.turn"
        class="turn"
        :style="{ display: -offset + finalOffset + h.top + h.height < baseY ? 'none' : 'block' }"
        @wheel.passive="onWheel"
        @touchstart.passive.stop="onTouchStart"
        @touchmove.stop="onTouchMove"
        @touchend.passive.stop="onTouchEnd"
        @touchcancel.passive.stop="onTouchEnd"
      >
        <div
          v-if="!h.finalScoring"
          :class="`number ${colorCssClass(h.player)} color-bg`"
          :style="{ top: `${finalOffset + h.top}px`, height: `${h.height}px`, 'clip-path': getClipPath(-offset + finalOffset + h.top, h.height) }"
          @click="toggleGameHistory"
        />

        <EventsRow
          v-for="(row, i) in h.rows"
          :key="i"
          :row="row"
          :player="h.player"
          :style="{ top: `${finalOffset + row.top}px`, 'clip-path': getClipPath(-offset + finalOffset + row.top, row.height) }"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

import EventsRow from '@/components/game/play-events/EventsRow'
import FinalScoringEvents from '@/components/game/FinalScoringEvents'

// vertical space reserved at the top of the strip for the history toggle button
const TOGGLE_HEIGHT = 34

// How many events share one line of a turn. A row is laid out as a flex line of fixed height and
// every following row's `top` is derived from it, so this cap — not CSS — is what decides whether
// events sit side by side. Dropping it to 1 gives each event its own line and the tops still add
// up; removing the flex instead would let a row grow past the height its neighbours were placed
// against, and the rows would overlap.
const EVENTS_PER_ROW = 4
// Small screens have no width for four events next to each other: one per line.
const EVENTS_PER_ROW_SMALL = 1
// Keep in step with $small-screen-max-width in assets/styles/shared.sass.
const SMALL_SCREEN_QUERY = '(max-width: 960px)'

export default {
  components: {
    EventsRow,
    FinalScoringEvents
  },

  data () {
    return {
      finalHeight: 0,
      offset: 0,
      smallScreen: false
    }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    eventsPerRow () {
      return this.smallScreen ? EVENTS_PER_ROW_SMALL : EVENTS_PER_ROW
    },

    ...mapState({
      history: state => state.game.history,
      phase: state => state.game.phase
    }),

    baseY () {
      // action panel height + gap, plus space reserved for the history toggle button. The panel
      // reports its real height (it grows to two lines with many actions); before it has, use the
      // fixed bar height (84 / 60) + 10.
      const panel = this.$store.state.board.actionPanelHeight
      const top = panel ? panel + 10 : (this.$vuetify.breakpoint.height > 768 ? 94 : 70)
      return top + TOGGLE_HEIGHT
    },

    // the toggle sits in the reserved header space, just above the strip content
    toggleTop () {
      return this.baseY - TOGGLE_HEIGHT
    },

    // amount the regular history is shifted down to sit below the final-scoring block.
    // includes a gap so the final score points are visually separated from the rest of
    // the history (only when the final-scoring block is actually shown).
    finalOffset () {
      return this.finalHeight > 0 ? this.finalHeight + 2 : 0
    },

    reversed () {
      const items = []
      const devMode = this.$store.state.settings.devMode
      let top = this.baseY
      for (let i = this.history.length - 1; i >= 0; i--) {
        if (this.history[i].finalScoring) {
          continue
        }
        if (i < this.history.length - 1 && !this.history[i].events.length) {
          // ignore empty rows - curently only if player pass during AbbeYEndGamePhase
          continue
        }
        const item = { ...this.history[i] }
        let lastRowIsScore = null
        let row = null
        item.rows = []
        // every shown event of the turn, shared by all its rows: score events sit in rows of their
        // own, so an event that needs its turn's scoring (the courier move) looks it up here
        const turnEvents = []
        item.events.forEach((ev, evIdx) => {
          // Dev builds label each event with where it sits in the raw history, so a thing seen on
          // screen can be found in the state without counting rows by hand. The index is the one
          // from the ORIGINAL array - events skipped below (big top moves) must not shift it.
          if (devMode) {
            ev = { ...ev, historyKey: `history[${i}].events[${evIdx}]` }
          }
          if (ev.type === 'neutral-moved' && ev.figure.startsWith('bigtop.') && !ev.cause) {
            // a big top move is always bound to its circus tile, so a bare one adds nothing; one
            // carrying its cause (the circus tile placed) stays, so the history tells why it moved
            return
          }

          const isScore = ev.type === 'points' || ev.type === 'token-received'
          const isNewLineEvent = ev.type === 'tile-auctioned' || ev.type === 'dragon-moved'
          if (isScore !== lastRowIsScore || isNewLineEvent || row?.events.length === this.eventsPerRow) {
            row = { events: [], height: isScore ? 27 : 41, turnEvents }
            item.rows.unshift(row)
            lastRowIsScore = isScore
          }
          row.events.push(ev)
          turnEvents.push(ev)
        })
        delete item.events
        if (i === this.history.length - 1 && this.phase !== 'CommitActionPhase' && this.phase !== 'GameOverPhase') {
          // The marker shares the newest row when there is space; it needs its own row when that
          // row is a score row, or is already full — which, at one event per line, it always is.
          if (!item.rows.length ||
              item.rows[0].events.length >= this.eventsPerRow ||
              item.rows[0].events[0].type === 'points') {
            item.rows.unshift({ events: [], height: 41 })
          }
          item.rows[0].events.push({ type: 'current-action' })
        }
        if (!item.rows.length) {
          // A turn with no events produced no rows (e.g. an immediately-over game whose only
          // turn placed just the start tile). Nothing to lay out — skip it instead of reading
          // item.rows[0].top on undefined (which crashed the whole game window).
          continue
        }
        let height = 0
        item.rows.forEach(row => {
          row.top = top
          top += row.height
          height += row.height
        })
        item.top = item.rows[0].top
        item.height = height - 1 // 1px margin
        items.push(item)
      }
      this.eventsHeight = top - this.baseY// eslint-disable-line
      return items
    }
  },

  watch: {
    history () {
      this.offset = 0
    }
  },

  created () {
    this._finalScoringResized = height => {
      this.finalHeight = height
    }
    this.$root.$on('final-scoring-height', this._finalScoringResized)
  },

  mounted () {
    // matchMedia rather than a resize listener: the only thing that matters is crossing the
    // breakpoint, and this fires once when it happens instead of on every pixel of a drag.
    if (window.matchMedia) {
      this._smallScreen = window.matchMedia(SMALL_SCREEN_QUERY)
      this.smallScreen = this._smallScreen.matches
      this._onSmallScreenChange = ev => { this.smallScreen = ev.matches }
      if (this._smallScreen.addEventListener) {
        this._smallScreen.addEventListener('change', this._onSmallScreenChange)
      } else {
        this._smallScreen.addListener(this._onSmallScreenChange) // older Safari
      }
    }
  },

  beforeDestroy () {
    this.$root.$off('final-scoring-height', this._finalScoringResized)
    if (this._smallScreen) {
      if (this._smallScreen.removeEventListener) {
        this._smallScreen.removeEventListener('change', this._onSmallScreenChange)
      } else {
        this._smallScreen.removeListener(this._onSmallScreenChange)
      }
    }
  },

  methods: {
    getClipPath (top, height) {
      if (top < this.baseY - 9) {
        return `inset(${this.baseY - 9 - top}px 0 0 0)`
      }
      return 'none'
    },

    toggleGameHistory () {
      this.$store.commit('toggleGameHistory')
    },

    // moves the history by delta px, kept within the events' height
    scrollBy (delta) {
      const availableHeight = document.documentElement.clientHeight - this.baseY
      const maxOffset = this.eventsHeight - availableHeight + this.finalOffset
      this.offset = Math.min(Math.max(0, this.offset + delta), Math.max(0, maxOffset))
    },

    onWheel (ev) {
      // handle wheel only on first item
      if (ev.clientX < 52) {
        this.scrollBy(ev.deltaY / 3)
      }
    },

    // Touch screens have no wheel: a vertical finger drag over the history scrolls it (the web
    // build on phones). The drag is kept from the board underneath, so it does not pan as well.
    onTouchStart (ev) {
      if (ev.touches.length !== 1) {
        this._touchY = null
        return
      }
      this._touchY = ev.touches[0].clientY
    },

    onTouchMove (ev) {
      if (this._touchY == null || ev.touches.length !== 1) return
      const y = ev.touches[0].clientY
      this.scrollBy(this._touchY - y)
      this._touchY = y
      if (ev.cancelable) ev.preventDefault()
    },

    onTouchEnd () {
      this._touchY = null
    }
  }
}
</script>

<style lang="sass" scoped>
.play-events
  user-select: none

  // Scroll layer. Zero-sized and pinned at the origin so its absolutely-positioned children
  // keep the exact screen coordinates they had before; scrolling only mutates this element's
  // transform, which the compositor handles on the GPU (no per-row layout).
  .events-scroll
    position: absolute
    top: 0
    left: 0
    width: 0
    height: 0
    will-change: transform

  // shift the panel right of the history strip (same x as the turn rows) so its
  // background no longer covers the final-scoring strip on the left
  ::v-deep .final-scoring-events
    left: 11px
    padding-left: 5px

  &.collapsed
    // hide final scoring together with the turn rows when history is toggled off.
    // use visibility (not display:none) so the panel keeps its measured height -
    // the strip's height is derived from it and must stay stable while collapsed.
    ::v-deep .final-scoring-events
      visibility: hidden

.history-toggle
  position: absolute
  left: 0
  z-index: 5
  display: flex
  align-items: center
  gap: 3px
  height: 26px
  padding: 0 9px
  border: none
  // square against the screen edge it sits on, rounded on the side facing the board
  border-radius: 0 13px 13px 0
  cursor: pointer
  background: rgba(0, 0, 0, 0.55)
  transition: background 0.15s

  &:hover
    background: rgba(0, 0, 0, 0.75)

  .v-icon
    color: #fff

.number
  position: absolute
  left: 0
  height: 40px
  align-self: stretch
  margin-right: 1px
  width: 10px
  cursor: pointer

.turn
  // vertical drags are the history's own scroll (onTouchMove), not the page's
  touch-action: none

.final-number
  // neutral strip for the final-scoring section (not tied to a player color)
  background: #9e9e9e
</style>
