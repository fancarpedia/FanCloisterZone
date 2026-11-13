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
    return { BASE_SIZE, FRAME_3X3: [lo, lo, hi, lo, hi, hi, lo, hi].join(' ') }
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
.emphasize-lightbox
  +theme using ($theme)
    fill: map-get($theme, 'emphasize-lightbox-fill')
</style>
