<template>
  <g id="feature-hints-layer">
    <defs>
      <component
        :is="p.component"
        v-for="p in mapped.usedPatterns"
        :id="p.id"
        :key="p.id"
        :pattern-transform="globalTransform + ' ' + (p.transform || '')"
        v-bind="p.props"
      />
    </defs>

    <defs>
      <clipPath
        v-for="fc in mapped.clips"
        :id="fc.id"
        :key="fc.id"
      >
        <FeatureClip
          v-for="(c, idx) in fc.clips"
          :key="idx"
          :clip="c.clip"
          :transform="c.transform"
        />
      </clipPath>
    </defs>

    <rect
      v-for="feat in mapped.features"
      :key="'feature-hint-' + feat.id"
      class="feature-hint-area"
      :clip-path="'url(#feature-hint-clip-' + feat.id + ')'"
      width="100%" height="100%"
      :fill="`url(#${feat.pattern})`"
    />
  </g>
</template>

<script>
// Like FarmHintsLayer, but for OCCUPIED non-field features (cities, roads, monasteries,
// castles, ...). Each is overlaid with a pattern in the current owner's colour (multicolor
// on ties). Fields/farmers are intentionally excluded — those are covered by FarmHintsLayer.
import { mapState } from 'vuex'

import CheckerPattern from '@/components/game/layers/patterns/CheckerPattern.vue'
import FeatureClip from '@/components/game/layers/FeatureClip.vue'
import LayerMixin from '@/components/game/layers/LayerMixin'
import LinePattern from '@/components/game/layers/patterns/LinePattern.vue'
import MultiColorPattern from '@/components/game/layers/patterns/MultiColorPattern.vue'
import TrianglePattern from '@/components/game/layers/patterns/TrianglePattern.vue'
import ZigZagPattern from '@/components/game/layers/patterns/ZigZagPattern.vue'

function positiveHashCode (str) {
  const code = str.split('').reduce((prevHash, currVal) =>
    (((prevHash << 5) - prevHash) + currVal.charCodeAt(0)) | 0, 0)
  return Math.abs(code)
}

function minLoc (places) {
  return places.reduce((min, p) => {
    const a = Math.abs(min[0]) + Math.abs(min[1])
    const b = Math.abs(p[0]) + Math.abs(p[1])
    if (a < b) return min
    if (a > b) return p
    if (min[2] <= p[2]) return min
    return p
  })
}

export default {
  components: {
    FeatureClip
  },

  mixins: [LayerMixin],

  props: {
    globalTransform: { type: String, required: true }
  },

  data () {
    return {
      patterns: [
        { component: CheckerPattern },
        { component: LinePattern },
        { component: TrianglePattern, transform: 'scale(1.5)' },
        { component: ZigZagPattern, transform: 'scale(1.4)' },
        { component: LinePattern, transform: 'rotate(45)' },
        { component: CheckerPattern, transform: 'rotate(45) scale(1.25)' },
        { component: LinePattern, transform: 'rotate(-45)' },
        { component: ZigZagPattern, transform: 'rotate(90) scale(1.4)' },
        { component: LinePattern, transform: 'rotate(-90)' }
      ]
    }
  },

  computed: {
    ...mapState({
      // occupied, non-field scoreable features, coloured by the current majority owner
      features: state => state.game.features.filter(f =>
        f.type !== 'Field' && f.owners && f.owners.length > 0)
    }),

    mapped () {
      const features = []
      const usedPatterns = {}
      const clips = []

      this.features.forEach(feature => {
        let places = []
        try {
          places = feature.places.map(place => {
            const location = place[2]
            const tile = this.tileOn(place)
            const f = this.$theme.getFeature(tile, feature.type, location)
            return { tile, ...f }
          }).filter(f => !!f.clip)
        } catch (e) {
          console.error(e)
          return
        }
        if (!places.length) return

        const featureId = minLoc(feature.places).join('-').replaceAll('.', '_')
        const patternIndex = positiveHashCode(featureId) % this.patterns.length
        const props = {}
        let pattern
        let patternId
        if (feature.owners.length > 1) {
          const owners = [...feature.owners]
          owners.sort()
          patternId = '-' + owners.join('-')
          pattern = { component: MultiColorPattern }
          props.players = owners
        } else {
          patternId = patternIndex + '--' + feature.owners[0]
          pattern = this.patterns[patternIndex]
          props.player = feature.owners[0]
        }

        patternId = 'feature-hint-pattern-' + patternId
        if (!usedPatterns[patternId]) {
          usedPatterns[patternId] = { id: patternId, props, ...pattern }
        }

        clips.push({
          id: 'feature-hint-clip-' + featureId,
          clips: places.map(p => {
            const tPos = this.transformPosition(p.tile.position)
            const fPos = this.transformRotation(p.rotation) + ' ' + (p.transform || '')
            return {
              transform: `${this.globalTransform} ${tPos} ${fPos}`,
              clip: p.clip
            }
          })
        })

        features.push({ id: featureId, pattern: patternId })
      })

      return {
        features,
        clips,
        usedPatterns: Object.values(usedPatterns)
      }
    }
  }
}
</script>
