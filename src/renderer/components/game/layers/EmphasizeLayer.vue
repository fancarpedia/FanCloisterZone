<template>
  <g
    id="emphasize-layer"
  >
    <defs>
      <mask id="emphasis-layer-mask">
        <rect x="0" y="0" width="100%" height="100vh" fill="white" />
        <g
          :transform="globalTransform"
          fill="black"
        >
          <rect
            v-if="emphasis.type === 'tile'"
            :x="0" :y="0" :width="BASE_SIZE" :height="BASE_SIZE"
            :transform="transformPosition(emphasis.position)"
          />
          <g
            v-else-if="emphasis.type === 'tiles'"
          >
            <rect
              v-for="pos in emphasis.positions"
              :key="positionAsKey(pos)"
              :x="0" :y="0" :width="BASE_SIZE" :height="BASE_SIZE"
              :transform="transformPosition(pos)"
            />
          </g>
          <circle
            v-else-if="emphasis.type === 'meeple'"
            :x="0" :y="0" :r="BASE_SIZE / 2"
            :transform="emphasis.barn || emphasis.obelisk ? transformPosition(emphasis.position) : transformPoint(emphasis)"
           />
          <g v-else-if="emphasis.type === 'feature'">
            <g
              v-for="(feature, idx) in featurePlaces"
              :key="idx"
              :transform="transformPosition(feature.tile.position)"
            >
              <g :transform="transformRotation(feature.rotation) + ' ' + (feature.transform || '')">
                <FeatureClip :clip="feature.clip" />
              </g>
            </g>
          </g>
          <!-- several single spots (e.g. the meeples in the courier's range): one opening each -->
          <g v-else-if="emphasis.type === 'points'">
            <circle
              v-for="(p, idx) in pointTransforms"
              :key="idx"
              :x="0" :y="0" :r="BASE_SIZE * 0.3"
              :transform="p"
            />
          </g>
          <circle
            v-else-if="emphasis.type === 'castle'"
            v-bind="castlePoint()" :r="BASE_SIZE * 0.6"
            :transform="transformPosition(emphasis.positions[0])"
          />
          <!-- a lit road's tunnel tokens: the token sits on the tile's tunnel spot, outside the road's
               own shape — open it too, so the whole road incl. its tunnels reads as one (any road
               highlight: scoring, deploys, …). Circle centred on the token as TokenLayer draws it. -->
          <circle
            v-for="(t, idx) in tunnelTransforms"
            :key="'tunnel-' + idx"
            cx="-40" cy="-40" :r="TUNNEL_RADIUS"
            :transform="t"
          />
          <!-- every meeple / figure the history draws back (EventMeeplesLayer, NeutralFigureGhostLayer)
               gets a circle in the dimming, so it is never shown greyed out under it -->
          <circle
            v-for="(t, idx) in figureTransforms"
            :key="'figure-' + idx"
            :x="0" :y="0" :r="BASE_SIZE * 0.3"
            :transform="t"
          />
          <!-- extra single spots opened on top of any emphasis type (e.g. the courier beside the
               feature it scored) -->
          <circle
            v-for="(p, idx) in extraPointTransforms"
            :key="'extra-' + idx"
            :x="0" :y="0" :r="BASE_SIZE * 0.3"
            :transform="p"
          />
          <!-- extra whole tiles opened on top (e.g. the tile whose placement caused the event) -->
          <rect
            v-for="(pos, idx) in emphasis.extraTiles || []"
            :key="'extra-tile-' + idx"
            :x="0" :y="0" :width="BASE_SIZE" :height="BASE_SIZE"
            :transform="transformPosition(pos)"
          />
        </g>
      </mask>
    </defs>

    <rect
      class="emphasize-lightbox"
      width="100%" height="100%"
      mask="url(#emphasis-layer-mask)"
    />
    <!-- what was counted for a score without scoring itself (a watchtower's monasteries, roads,
         cities, coat-of-arms segments): tinted in another colour over the lit area -->
    <g v-if="involvedPlaces.length" :transform="globalTransform" class="involved-shapes">
      <g
        v-for="(feature, idx) in involvedPlaces"
        :key="'involved-' + idx"
        :transform="transformPosition(feature.tile.position)"
      >
        <g :transform="transformRotation(feature.rotation) + ' ' + (feature.transform || '')">
          <FeatureClip :clip="feature.clip" />
        </g>
      </g>
    </g>
    <!-- optional range frame around a tile (3×3), drawn like the wagon's move range -->
    <g v-if="emphasis.frame" :transform="globalTransform">
      <polygon
        :transform="transformPosition(emphasis.frame)"
        :points="FRAME_3X3"
        fill="none"
        stroke="red"
        stroke-width="40"
        stroke-opacity="0.4"
      />
    </g>
  </g>
</template>

<script>
import LayerMixin from '@/components/game/layers/LayerMixin'
import FeatureClip from '@/components/game/layers/FeatureClip.vue'
import { BASE_SIZE } from '@/constants/ui'

export default {
  components: {
    FeatureClip
  },

  mixins: [LayerMixin],

  props: {
    globalTransform: { type: String, required: true },
    emphasis: { type: Object, required: true }
  },

  data () {
    // the tile at the origin plus one tile all around it, with a small margin
    const lo = -BASE_SIZE - 20
    const hi = 2 * BASE_SIZE + 20
    // a tunnel token is drawn 340 wide (TokenLayer) — a little more, so it shows whole
    return { BASE_SIZE, FRAME_3X3: [lo, lo, hi, lo, hi, hi, lo, hi].join(' '), TUNNEL_RADIUS: 190 }
  },

  computed: {
    // 'points': the feature point of each { position, feature, location }; spots the artwork does
    // not know are skipped rather than drawn at the board origin
    pointTransforms () {
      if (this.emphasis.type !== 'points') return []
      return this.toPointTransforms(this.emphasis.points)
    },

    extraPointTransforms () {
      return this.toPointTransforms(this.emphasis.extraPoints)
    },

    // emphasis.involved: [{ tile, feature, location }] — the shapes to tint (see the template)
    involvedPlaces () {
      try {
        return (this.emphasis.involved || [])
          .filter(p => p && p.tile)
          .map(({ tile, location, feature }) => ({ tile, ...this.$theme.getFeature(tile, feature, location, this.bridges) }))
          .filter(f => f.clip)
      } catch (e) {
        console.error(e)
        return []
      }
    },

    // where the meeples / figures currently drawn by the history layers stand: a feature point, a
    // tile corner (barn, obelisk) or a tile centre (a figure on the tile)
    figureTransforms () {
      const layers = this.$store.state.board.layers || {}
      const out = []
      const atTileCentre = pos => this.transformPosition(pos) + ` translate(${BASE_SIZE / 2} ${BASE_SIZE / 2})`
      const add = fn => {
        try {
          const t = fn()
          if (t) out.push(t)
        } catch (e) {
          // a spot the artwork does not know — skip it rather than draw at the board origin
        }
      }
      for (const m of (layers.EventMeeplesLayer && layers.EventMeeplesLayer.meeples) || []) {
        if (!m || !m.position) continue
        if (m.type === 'Barn' || m.type === 'Obelisk') {
          add(() => this.transformPosition(m.position)) // stands on the tile corner
        } else if (m.feature && m.location) {
          add(() => this.transformPoint(m))
        }
      }
      const ghostLayer = layers.NeutralFigureGhostLayer
      const ghosts = ghostLayer
        ? (ghostLayer.ghosts || (ghostLayer.figure && ghostLayer.ptr ? [{ ptr: ghostLayer.ptr }] : []))
        : []
      for (const g of ghosts) {
        const ptr = g && g.ptr
        if (!ptr) continue
        if (Array.isArray(ptr)) {
          if (ptr.length === 2) add(() => atTileCentre(ptr))
        } else if (ptr.position && ptr.feature && ptr.location) {
          add(() => this.transformPoint(ptr))
        } else if (ptr.position) {
          add(() => atTileCentre(ptr.position))
        }
      }
      return out
    },

    // the placed tunnel tokens on the lit road segments: same tile, and the token's side is part of
    // the segment (a token at "E" belongs to the road segment "E" / "WE" of that tile)
    tunnelTransforms () {
      if (this.emphasis.type !== 'feature') return []
      const tokens = this.$store.state.game.tokens || {}
      const tunnelEnds = Object.keys(tokens)
        .filter(k => k.startsWith('TUNNEL_'))
        .flatMap(k => tokens[k] || [])
        .filter(t => t && t.position && t.location)
      if (!tunnelEnds.length) return []
      const out = []
      for (const place of this.emphasis.places || []) {
        if (place.feature !== 'Road' || !place.tile || !place.location) continue
        const [x, y] = place.tile.position
        for (const t of tunnelEnds) {
          if (t.position[0] !== x || t.position[1] !== y) continue
          if (![...t.location].every(c => place.location.includes(c))) continue
          try {
            const tr = this.transformTunnelEnd(t)
            if (tr) out.push(tr)
          } catch (e) {
            console.warn('No tunnel spot for', t)
          }
        }
      }
      return out
    },

    featurePlaces () {
      try {
        if (this.emphasis.type === 'feature') {
          return this.emphasis.places.map(({ tile, location, feature }) => {
            return { tile, ...this.$theme.getFeature(tile, feature, location, this.bridges) }
          }).filter(f => {
            // be defensive
            if (!f.clip) {
              console.warn('Feature without clip', f)
            }
            return f.clip
          })
        }
      } catch (e) {
        console.error(e)
      }
      return []
    }
  },

  methods: {
    // the feature point of each { position, feature, location }; spots the artwork does not know
    // are skipped rather than drawn at the board origin
    toPointTransforms (points) {
      const out = []
      for (const p of points || []) {
        if (!p || !p.position || !p.feature || !p.location) continue
        try {
          const t = this.transformPoint(p)
          if (t) out.push(t)
        } catch (e) {
          console.warn('No point for', p)
        }
      }
      return out
    },

    castlePoint () {
      const { positions } = this.emphasis
      if (positions[0][0] === positions[1][0]) { /// compare X
        // vertical
        return positions[0][1] < positions[1][1] ? { cx: BASE_SIZE / 2, cy: BASE_SIZE } : { cx: BASE_SIZE / 2, cy: BASE_SIZE }
      } else {
        // horizontla
        return positions[0][0] < positions[1][0] ? { cx: BASE_SIZE, cy: BASE_SIZE / 2 } : { cx: 0, cy: BASE_SIZE / 2 }
      }
    }
  }
}
</script>

<style lang="sass" scoped>
// involved shapes (counted, not scored): amber
.involved-shapes
  fill: rgba(255, 179, 0, 0.42)
  stroke: rgba(255, 143, 0, 0.9)
  stroke-width: 12
  pointer-events: none

.emphasize-lightbox
  +theme using ($theme)
    fill: map-get($theme, 'emphasize-lightbox-fill')
</style>
