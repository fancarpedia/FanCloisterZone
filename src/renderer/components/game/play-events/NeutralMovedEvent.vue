<template>
  <div
    class="neutral-moved one-square"
    :title="causeTitle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <NeutralFigure :figure="figure" :width="34" :height="34" />
    <v-icon v-if="!ev.to">fas fa-slash</v-icon>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import { courierGhosts } from '@/utils/courier-ghosts'
import { causeMeeple, causeTitle, withCause } from '@/utils/placement-cause'

import NeutralFigure from '@/components/game/NeutralFigure'

export default {
  components: {
    NeutralFigure
  },

  props: {
    ev: { type: Object, required: true },
    // all events of the same turn — the courier's scoring follows its move there
    siblings: { type: Array, default: () => [] }
  },

  computed: {
    ...mapGetters({ tileOn: 'game/tileOn', featureOn: 'game/featureOn' }),

    figure () {
      return this.ev.figure.split('.')[0]
    },

    // what triggered this move when no player chose it (engine PlacementCause), as a tooltip
    causeTitle () {
      return causeTitle(this.ev.cause, this) || null
    }
  },

  methods: {
    onMouseEnter () {
      const { from, to } = this.ev
      // the action panel tells what happened and why (PlacementPanel)
      this.$store.commit('board/placementPanel', {
        kind: !to ? 'removed' : (!from ? 'placed' : 'moved'),
        figure: this.ev.figure,
        to: to && (to.featurePointer || to),
        cause: this.ev.cause || null
      })
      if (!to) {
        // removed from the board: show where it stood
        this.showMoveGhosts()
        return
      }
      if (this.figure === 'courier') {
        this.showCourierMove()
        return
      }

      let fp = null
      let meepleId = null
      if (to.featurePointer) {
        fp = to.featurePointer
        meepleId = to.meepleId
      } else if (to.position && to.location) {
        fp = to
      }

      if (fp) {
        this.$store.dispatch('board/showLayer', {
          layer: 'EmphasizeLayer',
          props: {
            emphasis: withCause({
              type: 'meeple',
              ...fp
            }, this.ev.cause)
          }
        })
      } else if (this.ev.to.length === 2) { // position
        this.$store.dispatch('board/showLayer', {
          layer: 'EmphasizeLayer',
          props: {
            emphasis: withCause({
              type: 'tile',
              position: this.ev.to
            }, this.ev.cause)
          }
        })
      }

      // where it came from (faded, dashed) and, if it has moved on since, where it went (pulsing)
      this.showMoveGhosts()

      // For the fairy / black fairy, also pulse the meeple it was placed next to — from the board if
      // still there, else from the engine-captured host meeple (same as the score hover).
      const fig = this.figure
      if (fig !== 'fairy' && fig !== 'black-fairy') {
        return
      }
      if (fp && meepleId) {
        // show the meeple the fairy is associated with (pulsing) — from the board if still there,
        // else from the engine-captured host meeple on the event
        const host = this.hostMeeple(meepleId, fp)
        if (host) {
          this.$store.dispatch('board/showLayer', {
            layer: 'EventMeeplesLayer',
            props: { meeples: [host], winners: [] }
          })
        }
      }
    },

    // Any neutral figure's move (fairy, black fairy, Count, mage, witch, Donkey, big top): its old
    // spot as a faded, still ghost in a dashed ring ('from'), and its new spot as the pulsing ghost
    // ('to') when the figure has moved on since — the same look as the courier's move.
    showMoveGhosts () {
      const symbol = this.figure === 'bigtop' ? 'big-top' : this.figure
      // a pointer of any shape → what the ghost layer places: a feature pointer, or [x, y]
      const spot = p => {
        if (!p) return null
        if (Array.isArray(p)) return p.length === 2 ? p : null
        const fp = p.featurePointer || p
        return fp.position ? fp : null
      }
      const ghosts = []
      const from = spot(this.ev.from)
      if (from) {
        ghosts.push({ figure: symbol, ptr: from, nextToMeeple: !!(this.ev.from && this.ev.from.meepleId), role: 'from' })
      }
      const to = spot(this.ev.to)
      if (to && this.isFairyRemoved(this.figure, to)) {
        ghosts.push({ figure: symbol, ptr: to, nextToMeeple: !!(this.ev.to && this.ev.to.meepleId), role: 'to' })
      }
      if (ghosts.length) {
        this.$store.dispatch('board/showLayer', {
          layer: 'NeutralFigureGhostLayer',
          props: { ghosts }
        })
      }
    },

    // The courier walked to (or was placed at) a spot and scored the occupied features within the
    // 3×3 tiles around it. Like the wagon's move range: frame those 3×3 tiles and open the dimming
    // only over the spots that matter — where it came FROM (the letter symbol on its first move, with
    // a pulsing courier ghost), where it went, and the scored meeples inside the range. Scored meeples
    // that have since left the board are drawn back pulsing, as a score event shows them.
    showCourierMove () {
      const entries = this.courierScoring()
      const from = this.ev.from && (this.ev.from.featurePointer || this.ev.from)
      const to = this.ev.to && (this.ev.to.featurePointer || this.ev.to)
      const center = to && to.position

      const inRange = m => !center || !m.position ||
        (Math.abs(m.position[0] - center[0]) <= 1 && Math.abs(m.position[1] - center[1]) <= 1)
      // the followers of the scored features that stand inside the range (a scored city may reach
      // far beyond it); a castle's vicinity can reach further, so fall back to the scoring pointer
      let scored = entries.flatMap(e => (e.meeples || []).filter(inRange))
      if (!scored.length) {
        scored = entries.map(e => e.ptr && (e.ptr.featurePointer || e.ptr)).filter(Boolean)
      }

      const points = [from, to, ...scored].filter(p => p && p.position && p.feature && p.location)
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        // plus what triggered the move: the placed letter tile, or the meeple it walked to
        props: { emphasis: withCause({ type: 'points', points, frame: center || null }, this.ev.cause) }
      })

      // the scored meeples that left the board since, and the deployed meeple that triggered the move
      // if it has left too
      const trigger = causeMeeple(this.ev.cause)
      const removed = [...scored, ...(trigger ? [trigger] : [])].filter(m => m.type && this.isMeepleRemoved(m))
      if (removed.length) {
        this.$store.dispatch('board/showLayer', {
          layer: 'EventMeeplesLayer',
          props: { meeples: removed, winners: [] }
        })
      }

      // the courier where it came from (absent on its first placement) and, if it has moved on
      // since, where it went — beside the meeple, as the board draws it
      const ghosts = courierGhosts(from, to, p => !this.isFairyRemoved('courier', p))
      if (ghosts.length) {
        this.$store.dispatch('board/showLayer', {
          layer: 'NeutralFigureGhostLayer',
          props: { ghosts }
        })
      }
    },

    // the courier.* points entries that follow this move in its turn, up to the next courier move
    courierScoring () {
      const list = this.siblings || []
      const start = list.indexOf(this.ev)
      if (start < 0) return []
      const out = []
      for (let i = start + 1; i < list.length; i++) {
        const e = list[i]
        if (e.type === 'neutral-moved' && (e.figure || '').startsWith('courier')) break
        if (e.type !== 'points') continue
        for (const p of e.points || []) {
          if ((p.name || '').startsWith('courier.')) out.push(p)
        }
      }
      return out
    },

    // is a scored meeple no longer standing at its recorded spot?
    isMeepleRemoved (m) {
      const dm = this.$store.state.game.deployedMeeples || []
      return !dm.some(d =>
        d.position && m.position &&
        d.position[0] === m.position[0] && d.position[1] === m.position[1] &&
        d.feature === m.feature && d.location === m.location
      )
    },

    // The meeple the fairy is associated with, to pulse on hover. Use the live deployed meeple when
    // it is still on the board, otherwise the engine-captured host meeple on the event (ev.hostMeeple)
    // — so it shows whether or not the meeple has since been removed, with no type guessing.
    hostMeeple (meepleId, fp) {
      const dm = this.$store.state.game.deployedMeeples || []
      const found = dm.find(m => m.id === meepleId)
      if (found) return found
      const hm = this.ev.hostMeeple
      if (!hm) return null
      return {
        type: hm.type,
        player: hm.player,
        position: fp.position,
        feature: fp.feature,
        location: fp.location
      }
    },

    // extract an [x,y] from a pointer of any shape (feature pointer, { position }, { featurePointer }
    // wrapper, or a bare position array used by the on-tile placement rule)
    ptrPosition (p) {
      if (!p) return null
      if (Array.isArray(p)) return p
      if (p.position) return p.position
      if (p.featurePointer) return p.featurePointer.position
      return null
    },

    // is the fairy/black-fairy no longer deployed at this spot? (handles next-to and on-tile shapes)
    isFairyRemoved (figure, ptr) {
      const dep = (this.$store.state.game.neutralFigures || {})[figure]
      if (!dep || !dep.placement) return true
      const curPos = this.ptrPosition(dep.placement)
      const evtPos = this.ptrPosition(ptr)
      if (!curPos || !evtPos) return true
      if (curPos[0] !== evtPos[0] || curPos[1] !== evtPos[1]) return true
      const curFp = dep.placement.featurePointer || dep.placement
      if (ptr.feature && curFp.feature && (curFp.feature !== ptr.feature || curFp.location !== ptr.location)) return true
      return false
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EventMeeplesLayer' })
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'NeutralFigureGhostLayer' })
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.neutral-moved
  position: relative

  i
    position: absolute
    left: -1px
    top: 2px
    font-size: 34px

    +theme using ($theme)
      color: map-get($theme, 'removed-color')
</style>
