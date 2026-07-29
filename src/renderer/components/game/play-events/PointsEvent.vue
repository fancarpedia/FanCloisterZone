<template>
  <div class="points-source">
    <div
      v-for="(p, idx) in ev.points"
      :key="idx"
      :class="'points ' + colorCssClass(p.player)"
      @mouseenter="onMouseEnter(p)"
      @mouseleave="onMouseLeave()"
      @click="persistBreakdown = !persistBreakdown"
    >
      {{ p.points }}
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  props: {
    ev: { type: Object, required: true }
  },

  data () {
    return {
      persistBreakdown: false
    }
  },

  computed: {
    ...mapGetters({
      tileOn: 'game/tileOn',
      featureOn: 'game/featureOn',
      colorCssClass: 'game/colorCssClass'
    })
  },

  methods: {
    onMouseEnter (points) {
      this.persistBreakdown = false
      const { ptr, meeples, majority } = points

      // Fairy / Black Fairy score events: show the exact spot (radius), and pulse the host meeple
      // and/or the fairy figure ONLY if they have since been removed from that spot — so the player
      // can see who/what earned the bonus even after the meeple or fairy is gone.
      const name = points.name || ''
      const isBlack = name.startsWith('black-fairy')
      if (isBlack || name.startsWith('fairy')) {
        const figure = isBlack ? 'black-fairy' : 'fairy'
        if (ptr) {
          const feature = this.featureOn(ptr)
          if (feature) this.showFeature(feature)
          else if (ptr.position) this.showTile(ptr.position)
        }
        // on-tile can affect several meeples on the tile; pulse every one that has been removed
        const removed = (meeples || []).filter(h => this.isMeepleRemoved(h))
        if (removed.length) {
          this.$store.dispatch('board/showLayer', {
            layer: 'EventMeeplesLayer',
            props: { meeples: removed, winners: [] }
          })
        }
        if (ptr && this.isFairyRemoved(figure, ptr)) {
          this.$store.dispatch('board/showLayer', {
            layer: 'NeutralFigureGhostLayer',
            props: { figure, ptr }
          })
        }
        this.$store.commit('board/pointsExpression', points)
        return
      }

      if (meeples && meeples.length) {
        // followers were returned to supply when the feature scored — draw them
        // back at their original positions so the player can see who scored, and crown
        // the meeples of the majority winners.
        const winners = (majority || []).filter(s => s.winner).map(s => s.player)
        this.$store.dispatch('board/showLayer', {
          layer: 'EventMeeplesLayer',
          props: { meeples, winners }
        })
      }
      if (ptr) {
        if (Array.isArray(ptr)) {
          this.showTile(ptr)
        } else if (ptr.positions) {
          this.showTiles(ptr.positions)
        } else if (ptr.position && !ptr.location) {
          this.showTile(ptr.position)
        } else {
          const feature = this.featureOn(ptr)
          if (feature) {
            this.showFeature(feature)
          } else {
            console.error('No feature found for ', ptr)
          }
        }
      }
      this.$store.commit('board/pointsExpression', points)
    },

    showTile (position) {
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'tile',
            position
          }
        }
      })
    },

    showTiles (positions) {
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'tiles',
            positions
          }
        }
      })
    },

    showFeature (feature) {
      const places = feature.places.map(p => {
        return {
          tile: this.tileOn(p),
          feature: feature.type,
          location: p[2]
        }
      })
      this.$store.dispatch('board/showLayer', {
        layer: 'EmphasizeLayer',
        props: {
          emphasis: {
            type: 'feature',
            places
          }
        }
      })
    },

    onMouseLeave () {
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EmphasizeLayer' })
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'EventMeeplesLayer' })
      this.$store.dispatch('board/hideLayerDebounced', { layer: 'NeutralFigureGhostLayer' })
      if (!this.persistBreakdown) {
        this.$store.commit('board/pointsExpression', null)
      }
    },

    // is the fairy's host meeple no longer on the board at its scoring spot?
    isMeepleRemoved (host) {
      const dm = this.$store.state.game.deployedMeeples || []
      return !dm.some(m =>
        m.position && host.position &&
        m.position[0] === host.position[0] && m.position[1] === host.position[1] &&
        m.feature === host.feature && m.location === host.location
      )
    },

    // extract an [x,y] from a pointer that may be a feature pointer, a { position } object,
    // a { featurePointer } wrapper, or a bare position array (on-tile placement)
    ptrPosition (p) {
      if (!p) return null
      if (Array.isArray(p)) return p
      if (p.position) return p.position
      if (p.featurePointer) return p.featurePointer.position
      return null
    },

    // is the fairy/black-fairy no longer deployed at the event's spot? (handles both next-to and
    // on-tile placements, whose current deployment / event ptr have different shapes)
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
    }
  }
}
</script>

<style lang="sass" scoped>
.points-source
  display: flex

.points
  width: 40px
  height: 26px
  text-align: center
  font-size: 18px
  cursor: pointer

  &:first-child
    border-radius: 13px 0 0 13px

  &:last-child
    border-radius: 0 13px 13px 0

  &:first-child:last-child
    border-radius: 13px
</style>
