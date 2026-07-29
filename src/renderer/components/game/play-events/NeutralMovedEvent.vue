<template>
  <div
    class="neutral-moved one-square"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <NeutralFigure :figure="figure" :width="34" :height="34" />
    <v-icon v-if="!ev.to">fas fa-slash</v-icon>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import NeutralFigure from '@/components/game/NeutralFigure'

export default {
  components: {
    NeutralFigure
  },

  props: {
    ev: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({ tileOn: 'game/tileOn' }),

    figure () {
      return this.ev.figure.split('.')[0]
    }
  },

  methods: {
    onMouseEnter () {
      const { to } = this.ev
      if (!to) {
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
            emphasis: {
              type: 'meeple',
              ...fp
            }
          }
        })
      } else if (this.ev.to.length === 2) { // position
        this.$store.dispatch('board/showLayer', {
          layer: 'EmphasizeLayer',
          props: {
            emphasis: {
              type: 'tile',
              position: this.ev.to
            }
          }
        })
      }

      // For the fairy / black fairy, also show the original placement: the meeple it was placed next
      // to, and the fairy figure — pulsing whichever has since been removed (same as the score hover).
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
      // the figure's spot: feature pointer (next-to) or the bare tile position (on-tile placement)
      const ghostPtr = fp || (Array.isArray(to) && to.length === 2 ? to : null)
      if (ghostPtr && this.isFairyRemoved(fig, ghostPtr)) {
        this.$store.dispatch('board/showLayer', {
          layer: 'NeutralFigureGhostLayer',
          props: { figure: fig, ptr: ghostPtr }
        })
      }
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
