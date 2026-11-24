<template>
  <StandaloneTileImage
    :tile-id="tileId"
    :rotation="rotation"
    :size="size"
    :class="{remote: !local}"
    @click="onClick"
  />
</template>

<script>
import LayeredItemMixin from '@/components/game/actions/items/LayeredItemMixin.js'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'

const getNextRotation = r => {
  if (r === 270) return 0
  return r + 90
}

export default {
  components: {
    StandaloneTileImage
  },

  mixins: [LayeredItemMixin],

  props: {
    tileId: { type: String, required: true },
    options: { type: Array, required: true },
    active: { type: Boolean },
    local: { type: Boolean },
    // Engine message dispatched on placement. Defaults to a normal draw placement; pre-draw uses
    // PLACE_PREDRAWN so the server validates the tile against the player's secret hand and reveals it.
    placeMessageType: { type: String, default: 'PLACE_TILE' },
    // fixed image size in px; null = the image's own (action panel) size. The pre-draw hand passes
    // its thumbnail size, so picking a tile doesn't blow it up and shift the hand around.
    size: { type: Number, default: null }
  },

  data () {
    return {
      rotation: 0
    }
  },

  computed: {
    layers () {
      return [['TilePlacementLayer', {
        tileId: this.tileId,
        rotation: this.rotation,
        options: this.options,
        local: this.local
      }]]
    }
  },

  watch: {
    // Tell other views of this tile how it is turned (PreDrawHand shows the supply / hand tile
    // being placed in the same rotation); 'tile-placement.gone' when this item goes. Both carry
    // this item's uid: Vue creates the next item before it destroys this one, so a bare "gone"
    // would wipe out the next tile's rotation.
    rotation: {
      immediate: true,
      handler (rotation) {
        this.$root.$emit('tile-placement.current', { uid: this._uid, tileId: this.tileId, rotation })
      }
    }
  },

  mounted () {
    this.onRightClick = ev => {
      if (this.local) {
        this.onClick()
      }
    }
    this.onRotate = r => {
      this.rotation = r
    }
    this.$root.$on('rclick', this.onRightClick)
    this.$root.$on('tile-placement.select', this.onSelect)
    this.$root.$on('tile-placement.rotation', this.onRotate)
  },

  beforeDestroy () {
    this.$root.$emit('tile-placement.gone', this._uid)
    this.$root.$off('rclick', this.onRightClick)
    this.$root.$off('tile-placement.select', this.onSelect)
    this.$root.$off('tile-placement.rotation', this.onRotate)
  },

  methods: {
    async onSelect ({ position, rotation }) {
      if (this.active && this.local) {
        await this.$store.dispatch('game/apply', {
          type: this.placeMessageType,
          payload: {
            tileId: this.tileId,
            rotation: 'R' + rotation,
            position
          }
        })
      }
    },
    onClick () {
      const mouseOver = this.$store.state.board.tilePlacementMouseOver
      console.log(mouseOver)
      if (mouseOver) {
        const pos = mouseOver[0]
        const rotations = this.options.find(({ position: p }) => p[0] === pos[0] && p[1] === pos[1])?.rotations
        if (rotations?.length) {
          while (true) {
            this.rotation = getNextRotation(this.rotation)
            if (rotations.includes(this.rotation)) {
              return
            }
          }
        }
      }
      this.rotation = getNextRotation(this.rotation)
    }
  }
}
</script>

<style lang="sass" scoped>
svg
  margin: 0 30px

  &.remote
    filter: grayscale(1)

  &.remote:hover
    filter: none
</style>
