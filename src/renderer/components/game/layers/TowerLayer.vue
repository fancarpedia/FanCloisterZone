<template>
  <g id="tower-layer">
    <g
      v-for="({ height, tile, point, rotation, transform, fill, textColor, stroke }) in towerItems"
      :key="positionAsKey(tile.position)"
      :transform="`${transformPosition(tile.position)} ${transformRotation(rotation)} ${transform} translate(${point[0]} ${point[1]}) rotate(${-rotation} 0 0)`"
    >
      <rect
        class="tower"
        x="-170" y="-170" width="340" height="340"
        :stroke="stroke" stroke-width="40" stroke-opacity="0.8" stroke-dasharray="38"
        :fill="fill" fill-opacity="0.65"
      />
      <text x="-60" y="65" :fill="textColor" style="font-size: 192px; font-weight: 600">{{ height }}</text>
    </g>
  </g>
</template>

<script>
import { mapState } from 'vuex'

import LayerMixin from '@/components/game/layers/LayerMixin'

export default {
  mixins: [LayerMixin],

  computed: {
    ...mapState({
      towers: state => state.game.features.filter(f => f.type === 'Tower' && f.height)
    }),

    towerItems () {
      return this.towers.map(t => {
        const { tile, point, rotation, transform } = this.getTilePoint({ position: t.places[0], feature: 'Tower', location: 'I' })
        let fill = 'burlywood'
        let color = 'black'
        let stroke = 'black'
        if (t.lastPiece == 'WHITE_TOWER_PIECE') {
          fill = 'white'
          color = 'transparent'
        } else if (t.lastPiece == 'BLACK_TOWER_PIECE') {
          fill = 'black'
          color = 'white'
          stroke = 'white'
        }
        return {
          height: t.height,
          tile,
          point,
          rotation,
          transform,
          fill,
          textColor: color,
          stroke
        }
      })
    }
  }
}
</script>
