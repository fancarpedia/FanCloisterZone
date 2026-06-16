<template>
  <g id="event-meeples-layer">
    <g
      v-for="group in groups"
      :key="group.key"
      :transform="transformPoint(group) + ' ' + rotateMeeple()"
    >
      <g
        v-for="(meeple, idx) in group.meeples"
        :key="idx"
        :transform="`translate(${meeple.x} ${meeple.y})`"
        :class="colorCssClass(meeple.player)"
      >
        <use
          :class="{ meeple: true, 'event-meeple': true, 'rot-90': meeple.rotate90 }"
          :x="-MEEPLE_SIZE / 2"
          :y="-MEEPLE_SIZE / 2"
          :width="MEEPLE_SIZE"
          :height="MEEPLE_SIZE"
          :href="`${MEEPLES_SVG}#${svgMeepleId(meeple)}`"
        />
      </g>
    </g>
  </g>
</template>

<script>
// Temporary layer shown while hovering a play event, to draw the meeple(s) the event
// concerns at their board positions (type + owner colour). Used by:
//   - PointsEvent / score bullets � the followers that scored a feature (returned to
//     supply, so this redraws their original positions)
//   - MeepleDeployedEvent � the meeple that was just deployed
import { mapState } from 'vuex'
import groupBy from 'lodash/groupBy'
import kebabCase from 'lodash/kebabCase'

import LayerMixin from '@/components/game/layers/LayerMixin'
import { BASE_SIZE } from '@/constants/ui'

const MEEPLES_SVG = require('~/assets/meeples.svg')

export default {
  mixins: [LayerMixin],

  props: {
    // each: { type, player, position, feature, location }
    meeples: { type: Array, required: true }
  },

  data () {
    return {
      MEEPLES_SVG,
      BASE_SIZE,
      MEEPLE_SIZE: BASE_SIZE * 0.32
    }
  },

  computed: {
    ...mapState({
      rotate: state => state.board.rotate
    }),

    groups () {
      const getGroupKey = ptr => `${ptr.position[0]},${ptr.position[1]},${ptr.feature}/${ptr.location}`
      const groupped = groupBy(this.meeples, getGroupKey)
      return Object.entries(groupped).map(([key, meeples]) => {
        const sample = meeples[0]
        const deployedOnFarm = sample.feature === 'Field'
        let x = 0
        let y = 0
        return {
          key,
          position: sample.position,
          feature: sample.feature,
          location: sample.location,
          meeples: meeples.map(m => {
            const mapped = {
              ...m,
              x,
              y,
              rotate90: m.location === 'AS_ABBOT' ||
                (deployedOnFarm && !['Shepherd', 'Pig', 'DecinskySneznik', 'Windmill'].includes(m.type))
            }
            x += m.type === 'SmallFollower' ? BASE_SIZE * 0.1 : BASE_SIZE * 0.14
            y += BASE_SIZE * 0.02
            return mapped
          })
        }
      })
    }
  },

  methods: {
    svgMeepleId (meeple) {
      return kebabCase(meeple.type)
    },

    rotateMeeple () {
      return `rotate(${-1 * this.rotate} 0 0)`
    }
  }
}
</script>

<style lang="sass" scoped>
.event-meeple
  opacity: 0.85
  // subtle pulse so the temporary event meeple reads as a highlight
  animation: event-meeple-pulse 1s ease-in-out infinite

@keyframes event-meeple-pulse
  0%
    opacity: 0.45
  50%
    opacity: 0.9
  100%
    opacity: 0.45
</style>
