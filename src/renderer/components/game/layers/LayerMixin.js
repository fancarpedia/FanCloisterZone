import { mapGetters, mapState } from 'vuex'
import { BASE_SIZE } from '@/constants/ui'

export default {
  computed: {
    ...mapGetters({
      bridges: 'game/bridges',
      colorCssClass: 'game/colorCssClass',
      isDragging: 'board/isDragging',
      tileOn: 'game/tileOn'
    }),

    ...mapState({
      boardRotation: state => state.board.rotate
    })
  },

  methods: {
    /**
     * Cancels the board's rotation, so whatever it is applied to stays upright on screen while
     * the board is turned. Append it to a group's transform; it pivots on that group's own
     * origin, so the anchor point does not move — only the orientation changes.
     *
     * Anything with a readable face (a figure, a number, a label) needs this. MeepleLayer and
     * EventMeeplesLayer each have their own `rotateMeeple()` doing exactly the same thing.
     */
    counterBoardRotation () {
      return `rotate(${-(this.boardRotation || 0)} 0 0)`
    },

    /**
     * Same, pivoting on (cx, cy) of the group's own coordinates — for a figure or piece drawn off
     * its origin (an image from 0,0, a box beside the point), turned upright around its middle so
     * it stays on its spot. Empty while the board is not turned.
     */
    /**
     * The bridge shape's transform on its tile, so a bridge only ever reads at 0° or 90° on
     * screen: 180° looks like 0°, 270° like 90° (the arch never hangs upside down).
     *
     * What counts is where the bridge ends up on screen: its own orientation (a north-south
     * bridge is already turned 90°) plus the board's. It is flipped half a turn whenever that sum
     * lands on 180° or 270° — e.g. a north-south bridge flips on a board turned 90° or 180°, an
     * east-west one on a board turned 180° or 270°.
     */
    bridgeTransform (location) {
      const own = location === 'NS' ? 90 : 0
      const onScreen = (((own + (this.boardRotation || 0)) % 360) + 360) % 360
      const flip = onScreen >= 180 ? 'rotate(180 450 450)' : ''
      const ns = own ? 'rotate(90 450 450)' : ''
      return [flip, ns].filter(Boolean).join(' ')
    },

    upright (cx = 0, cy = 0) {
      const r = -(this.boardRotation || 0)
      return r ? `rotate(${r} ${cx} ${cy})` : ''
    },

    positionAsKey (pos) {
      return `${pos[0]},${pos[1]}`
    },

    positionsAsKey (positions) {
      return positions.map(pos => this.positionAsKey(pos)).join(';')
    },

    pointerAsKey (ptr) {
      if (ptr?.length === 3) {
        return ptr.join(',')
      }
      return `${ptr.position[0]},${ptr.position[1]},${ptr.feature}/${ptr.location}`
    },

    getX (pos) {
      return pos[0] * BASE_SIZE
    },

    getY (pos) {
      return pos[1] * BASE_SIZE
    },

    getTilePoint ({ position, feature, location }) {
      const tile = this.tileOn(position)
      const featureObj = this.$theme.getFeature(tile, feature, location, this.bridges)
      return {
        tile,
        point: featureObj.point,
        rotation: featureObj.rotation,
        transform: featureObj.transform,
        inverseScaleTransform: featureObj.inverseScaleTransform
      }
    },

    transformPosition (pos) {
      return `translate(${this.getX(pos)} ${this.getY(pos)})`
    },

    transformRotation (rot) {
      const c = BASE_SIZE / 2
      return `rotate(${rot} ${c} ${c})`
    },

    transformPoint (ptr) { // ptr is { position, feature, location }, extraRotation for tokens
      const { tile, point, rotation, transform, inverseScaleTransform } = this.getTilePoint(ptr)
      const extraRotation = !!ptr.extraRotation ? ptr.extraRotation : 0
      if (!point) {
        console.warn('Point not defined', ptr)
        return ''
      }
      return `${this.transformPosition(tile.position)} ${this.transformRotation(rotation + (!!extraRotation ? extraRotation : 0))} ${transform || ''} translate(${point[0]} ${point[1]}) rotate(${-rotation} 0 0) ${inverseScaleTransform || ''}`
    },

    transformTunnelEnd (ptr) {
      const { position, location } = ptr

      const tile = this.tileOn(position)
      const feature = this.$theme.getFeature(tile, 'Tunnel', location, [])
      const { point, rotation, transform, inverseScaleTransform } = feature
      return `${this.transformPosition(tile.position)} ${this.transformRotation(rotation)} ${transform || ''} translate(${point[0]} ${point[1]}) rotate(${-rotation} 0 0) ${inverseScaleTransform || ''}`
    }
  }
}
