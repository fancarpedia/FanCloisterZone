<template>
  <g id="tile-placement-layer">
    <!-- Ghost preview of the bridge the hovered rotation would place. The Bridges expansion lets
         a tile be placed at a rotation that is only legal because a bridge is auto-placed (on this
         tile or an adjacent one); the engine reports it per-rotation in option.bridges. Drawn dashed
         + translucent (vs. the solid placed bridge in BridgeLayer) so it reads as "will be placed".
         Its position can differ from the tile position (adjacent-tile case), so it is drawn in board
         space, not inside the per-option group. -->
    <g v-if="previewBridge" :transform="transformPosition(previewBridge.position)">
      <path
        class="preview-bridge"
        d="M 0 540 L 0 360 L 900 360 L 900 540 L 765 540 C 765 392 135 392 135 540 Z"
        :transform="previewBridge.location === 'NS' ? 'rotate(90 450 450)' : ''"
      />
    </g>

    <g
      v-for="{ position: pos, rotations, bridgeMode } in optionViews"
      :key="positionAsKey(pos)"
      :transform="transformPosition(pos)"
    >
      <rect
        v-if="!mouseOver || mouseOver[0] !== pos"
        class="available-tile"
        :class="{ local }"
        :x="BASE_SIZE * 0.06" :y="BASE_SIZE * 0.06" :width="BASE_SIZE * 0.88" :height="BASE_SIZE * 0.88"
      />

      <!-- Badge (top-right) telling the player how a bridge relates to this square:
             required — every valid rotation here spends a bridge (solid amber);
             optional — a bridge-free rotation exists but some rotations use one (dashed, hollow).
           Squares needing no bridge get no badge. Partially transparent; pointer-events off so it
           never steals a placement click. -->
      <g v-if="bridgeMode" class="bridge-badge" :class="`bridge-badge--${bridgeMode}`" :style="{ 'pointer-events': 'none' }">
        <title>{{ bridgeMode === 'required' ? $t('game.action.placement-requires-bridge') : $t('game.action.placement-optional-bridge') }}</title>
        <rect :x="BASE_SIZE * 0.6" :y="BASE_SIZE * 0.08" :width="BASE_SIZE * 0.32" :height="BASE_SIZE * 0.16" :rx="BASE_SIZE * 0.04" class="bridge-badge-bg" />
        <path
          d="M 0 540 L 0 360 L 900 360 L 900 540 L 765 540 C 765 392 135 392 135 540 Z"
          class="bridge-badge-icon"
          :transform="`translate(${BASE_SIZE * 0.63} ${BASE_SIZE * 0.03}) scale(0.26)`"
        />
      </g>

      <!-- invisible rect for tracking mouse events -->
      <rect
        :x="0" :y="0" :width="BASE_SIZE" :height="BASE_SIZE"
        :style="{'pointer-events': 'all', fill: 'none'}"
        @mouseenter="local && onMouseOver(pos, getForcedRotation(rotations))"
        @mouseleave="local && onMouseLeave()"
        @click="ev => local && onClick(ev, rotations, pos)"
      />
    </g>
  </g>
</template>

<script>
import { mapState } from 'vuex'
import LayerMixin from '@/components/game/layers/LayerMixin'
import { BASE_SIZE } from '@/constants/ui'

export default {
  mixins: [LayerMixin],

  props: {
    tileId: { type: String, required: true },
    rotation: { type: Number, required: true },
    options: { type: Array, required: true },
    local: { type: Boolean }
  },

  data () {
    return { BASE_SIZE }
  },

  computed: {
    ...mapState({
      mouseOver: state => state.board.tilePlacementMouseOver
    }),

    artwork () {
      return this.$theme.getTileArtwork(this.tileId)
    },

    background () {
      return this.artwork?.background
    },

    backgroundScale () {
      const w = this.background.width / this.background.cols
      const h = this.background.height / this.background.rows
      return `scale(${BASE_SIZE / w} ${BASE_SIZE / h})`
    },

    // Each placement square classified by how a bridge relates to it, for the badge:
    //   null      — no rotation here needs a bridge
    //   'required' — every valid rotation here needs a bridge (no bridge-free option)
    //   'optional' — some rotations need a bridge, but at least one does not
    optionViews () {
      return this.options.map(o => {
        const bridgeCount = o.bridges ? Object.keys(o.bridges).length : 0
        const bridgeMode = bridgeCount === 0
          ? null
          : (bridgeCount >= o.rotations.length ? 'required' : 'optional')
        return { ...o, bridgeMode }
      })
    },

    // The bridge that the hovered placement would auto-place AT THE CURRENTLY SHOWN ROTATION,
    // or null. Only the shown rotation's bridge is previewed so the ghost always matches the
    // tile ghost — rotations that need no bridge show none. (The badge still marks the square as
    // bridge-capable.) Shape matches BridgeLayer: { position, location }.
    previewBridge () {
      if (!this.mouseOver) return null
      const [pos, rot] = this.mouseOver
      const opt = this.options.find(({ position }) => position[0] === pos[0] && position[1] === pos[1])
      if (!opt || !opt.bridges) return null
      return opt.bridges[rot] || null
    }
  },

  watch: {
    rotation () {
      if (this.mouseOver) {
        const opt = this.options.find(({ position }) => position === this.mouseOver[0])
        opt && this.$store.commit('board/tilePlacementMouseOver', [this.mouseOver[0], this.getForcedRotation(opt.rotations)])
      }
    }
  },

  methods: {
    onMouseOver (position, rotation) {
      this.$store.commit('board/tilePlacementMouseOver', [position, rotation])
    },

    onMouseLeave () {
      this.$store.commit('board/tilePlacementMouseOver', null)
    },

    getForcedRotation (rotations) {
      if (!rotations.includes(this.rotation)) {
        this.$root.$emit('tile-placement.rotation', rotations[0])
      }
      return this.rotation
    },

    onClick (ev, rotations, position) {
      if (this.isDragging(ev)) {
        return
      }

      const rotation = this.getForcedRotation(rotations)
      if (rotations.includes(rotation)) {
        this.$root.$emit('tile-placement.select', { position, rotation })
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.available-tile
  stroke-width: 63px
  fill: none

  +theme using ($theme)
    stroke: map-get($theme, 'tile-placement-remote')

    &.local
      stroke: map-get($theme, 'tile-placement-local')

// Ghost of the bridge a hovered rotation would place: same shape as BridgeLayer, but dashed and
// translucent so it clearly reads as a preview rather than an already-placed bridge.
.preview-bridge
  fill: brown
  fill-opacity: 0.28
  stroke: brown
  stroke-width: 18px
  stroke-dasharray: 55 40
  stroke-linejoin: round

.bridge-badge
  opacity: 0.72

.bridge-badge-icon
  fill: #5a3a1a
  stroke: #2f1d0d
  stroke-width: 15px

// Required: solid amber badge — no bridge-free rotation, placing here always spends a bridge.
.bridge-badge--required
  .bridge-badge-bg
    fill: #f0a21e
    fill-opacity: 0.95
    stroke: #7a4a10
    stroke-width: 14px

// Optional: hollow, dashed badge (echoes the dashed ghost = tentative) — a bridge-free rotation
// exists, so the bridge is a choice, not a cost you must pay.
.bridge-badge--optional
  .bridge-badge-bg
    fill: white
    fill-opacity: 0.7
    stroke: #7a4a10
    stroke-width: 12px
    stroke-dasharray: 42 30

</style>
