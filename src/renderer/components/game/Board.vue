<template>
  <svg
    ref="svg"
    class="board"
    :class="{ 'overlay': overlay }"
    draggable
    @wheel.passive="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @click.right="onRightClick"
  >
    <g :transform="transform">
      <TileLayer />
    </g>
    <FarmHintsLayer v-if="layers.FarmHintsLayer" :global-transform="transform" />
    <FeatureHintsLayer v-if="layers.FeatureHintsLayer" :global-transform="transform" />
    <g :transform="transform">
      <TilePlacementLayer
        v-if="layers.TilePlacementLayer"
        v-bind="layers.TilePlacementLayer"
      />
      <CastleLayer v-if="elements.castle" />
      <TowerLayer v-if="elements.tower" />
      <TokenLayer />
      <FlierLayer />
      <MeepleLayer />
      <BridgeLayer v-if="elements.bridge" />
      <MeepleLayer deployed-on-bridge />
      <WagonPhaseLayer
        v-if="layers.WagonPhaseLayer"
        v-bind="layers.WagonPhaseLayer"
      />
    </g>
    <EmphasizeLayer
      v-if="layers.EmphasizeLayer"
      v-bind="layers.EmphasizeLayer"
      :global-transform="transform"
    />
    <g :transform="transform">
      <ScoreLayer />
      <EventMeeplesLayer
        v-if="layers.EventMeeplesLayer"
        v-bind="layers.EventMeeplesLayer"
      />
      <NeutralFigureGhostLayer
        v-if="layers.NeutralFigureGhostLayer"
        v-bind="layers.NeutralFigureGhostLayer"
      />
      <FeatureSelectLayer
        v-if="layers.FeatureSelectLayer"
        v-bind="layers.FeatureSelectLayer"
      />
      <FerryChangeLayer
        v-if="layers.FerryChangeLayer"
        v-bind="layers.FerryChangeLayer"
      />
      <TunnelSelectLayer
        v-if="layers.TunnelSelectLayer"
        v-bind="layers.TunnelSelectLayer"
      />
      <CastleBaseSelectLayer
        v-if="layers.CastleBaseSelectLayer"
        v-bind="layers.CastleBaseSelectLayer"
      />
      <TileSelectLayer
        v-if="layers.TileSelectLayer"
        v-bind="layers.TileSelectLayer"
      />
      <TowerSelectLayer
        v-if="layers.TowerSelectLayer"
        v-bind="layers.TowerSelectLayer"
      />
      <BridgeSelectLayer
        v-if="layers.BridgeSelectLayer"
        v-bind="layers.BridgeSelectLayer"
      />
      <DragonMoveLayer
        v-if="layers.DragonMoveLayer"
        v-bind="layers.DragonMoveLayer"
      />
    </g>
  </svg>
</template>

<script>
import Vue from 'vue'
import { mapGetters, mapState } from 'vuex'

import BridgeLayer from '@/components/game/layers/BridgeLayer'
import BridgeSelectLayer from '@/components/game/layers/BridgeSelectLayer'
import CastleLayer from '@/components/game/layers/CastleLayer'
import CastleBaseSelectLayer from '@/components/game/layers/CastleBaseSelectLayer'
import DragonMoveLayer from '@/components/game/layers/DragonMoveLayer'
import EmphasizeLayer from '@/components/game/layers/EmphasizeLayer'
import FarmHintsLayer from '@/components/game/layers/FarmHintsLayer'
import FeatureHintsLayer from '@/components/game/layers/FeatureHintsLayer'
import FerryChangeLayer from '@/components/game/layers/FerryChangeLayer'
import FlierLayer from '@/components/game/layers/FlierLayer'
import TokenLayer from '@/components/game/layers/TokenLayer'
import TowerLayer from '@/components/game/layers/TowerLayer'
import FeatureSelectLayer from '@/components/game/layers/FeatureSelectLayer'
import EventMeeplesLayer from '@/components/game/layers/EventMeeplesLayer'
import NeutralFigureGhostLayer from '@/components/game/layers/NeutralFigureGhostLayer'
import MeepleLayer from '@/components/game/layers/MeepleLayer'
import ScoreLayer from '@/components/game/layers/ScoreLayer'
import TileLayer from '@/components/game/layers/TileLayer'
import TilePlacementLayer from '@/components/game/layers/TilePlacementLayer'
import TileSelectLayer from '@/components/game/layers/TileSelectLayer'
import TowerSelectLayer from '@/components/game/layers/TowerSelectLayer'
import TunnelSelectLayer from '@/components/game/layers/TunnelSelectLayer'
import WagonPhaseLayer from '@/components/game/layers/WagonPhaseLayer'
import { BASE_SIZE } from '@/constants/ui'

const ACTION_PANEL_HEIGHT = 160
const KEY_PRESSED_OFFSET = 30

export default {
  components: {
    BridgeLayer,
    BridgeSelectLayer,
    CastleLayer,
    CastleBaseSelectLayer,
    DragonMoveLayer,
    EmphasizeLayer,
    FarmHintsLayer,
    FeatureHintsLayer,
    FeatureSelectLayer,
    FerryChangeLayer,
    FlierLayer,
    EventMeeplesLayer,
    NeutralFigureGhostLayer,
    MeepleLayer,
    ScoreLayer,
    TileLayer,
    TilePlacementLayer,
    TileSelectLayer,
    TokenLayer,
    TowerLayer,
    TowerSelectLayer,
    TunnelSelectLayer,
    WagonPhaseLayer
  },

  data () {
    return {
      offsetX: 0,
      offsetY: 0,
      overlay: false,
      rotate: 0
    }
  },

  computed: {
    ...mapState({
      layers: state => state.board.layers,
      dragging: state => state.board.dragging,
      zoom: state => state.board.zoom.toFixed(3),
      elements: state => state.game.setup ? state.game.setup.elements : {}
    }),

    ...mapGetters({
      bounds: 'board/bounds'
    }),

    transform () {
      const x = this.offsetX
      const y = this.offsetY
      return `rotate(${this.rotate} ${x} ${y}) translate(${x} ${y}) scale(${this.zoom} ${this.zoom})`
    },

    tileSize () {
      return Math.round(BASE_SIZE * this.zoom)
    },

    boardWidth () {
      return this.bounds.width * this.tileSize
    },

    boardHeight () {
      return this.bounds.height * this.tileSize
    }
  },

  mounted () {
    const rect = this.$el.getBoundingClientRect()
    if (this.boardWidth > rect.width) {
      this.offsetX = parseInt(rect.width / 2)
    } else {
      this.offsetX = parseInt((rect.width - this.boardWidth) / 2)
    }
    if (this.boardHeight > rect.height - ACTION_PANEL_HEIGHT) {
      this.offsetY = ACTION_PANEL_HEIGHT + parseInt((rect.height - ACTION_PANEL_HEIGHT) / 2)
    } else {
      this.offsetY = ACTION_PANEL_HEIGHT + parseInt((rect.height - this.boardHeight - ACTION_PANEL_HEIGHT) / 2)
    }
    	

    this.pressedKeys = {}
    // Active pointers, keyed by pointerId: 1 = pan, 2 = pinch-zoom. Deliberately NOT reactive —
    // it changes on every pointermove and nothing renders from it.
    this.pointers = new Map()
    this.pinchDist = 0
    // this._onKeyDown = this.onKeyDown.bind(this)
    // this._onKeyUp = this.onKeyUp.bind(this)
    // this._stopDragging = this.stopDragging.bind(this)
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    // on document, so a drag that ends outside the board still releases
    document.addEventListener('pointerup', this.onPointerUp)
    document.addEventListener('pointercancel', this.onPointerUp) // touch interrupted (call, gesture)
    document.addEventListener('mouseleave', this.stopDragging)
    this.$root.$on('request-zoom', this.onRequestZoom)
    this.$root.$on('request-rotate', this.onRequestRotate)
  },

  beforeDestroy () {
    clearInterval(this.pressedKeysInterval)
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerup', this.onPointerUp)
    document.removeEventListener('pointercancel', this.onPointerUp)
    document.removeEventListener('mouseleave', this.stopDragging)
    this.$root.$off('request-zoom', this.onRequestZoom)
    this.$root.$off('request-rotate', this.onRequestRotate)
  },

  watch: {
    '$store.state.showGameFarmHints' (value) {
      if (value) {
        this.$store.dispatch('board/showLayer', { layer: 'FarmHintsLayer', props: {} })
      } else {
        this.$store.dispatch('board/hideLayer', { layer: 'FarmHintsLayer' })
      }
    },

    '$store.state.showGameFeatureHints' (value) {
      if (value) {
        this.$store.dispatch('board/showLayer', { layer: 'FeatureHintsLayer', props: {} })
      } else {
        this.$store.dispatch('board/hideLayer', { layer: 'FeatureHintsLayer' })
      }
    }
  },
  
  methods: {
    onKeyDown (ev) {
      if (['a', 's', 'd', 'w', 'r', 't', 'h', 'f'].includes(ev.key) && !this.$store.state.gameDialog && !this.$store.state.gameChatEdit) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) {
          return
        }
        this.pressedKeys[ev.key] = true
        if (!this.pressedKeysInterval) {
          this.pressedKeysInterval = setInterval(() => {
            let pressed = false
            if (this.pressedKeys.a) {
              this.offsetX -= KEY_PRESSED_OFFSET
              pressed = true
            }
            if (this.pressedKeys.d) {
              this.offsetX += KEY_PRESSED_OFFSET
              pressed = true
            }
            if (this.pressedKeys.s) {
              this.offsetY += KEY_PRESSED_OFFSET
              pressed = true
            }
            if (this.pressedKeys.r) {
              this.changeRotate()
              pressed = true
            }
            if (this.pressedKeys.w) {
              this.offsetY -= KEY_PRESSED_OFFSET
              pressed = true
            }
            if (this.pressedKeys.f) {
              this.$store.commit('toggleGameFarmHints')
            }
            if (this.pressedKeys.h) {
              this.$store.commit('toggleGameHistory')
            }
            if (this.pressedKeys.t) {
              this.$store.commit('toggleGameFeatureHints')
            }
            if (pressed) {
              this.adjustAfterMove()
            } else {
              clearInterval(this.pressedKeysInterval)
              this.pressedKeysInterval = null
            }
          }, 40)
        }
      }
      if (ev.key === 'Tab' && !this.$store.state.gameDialog) {
        this.$root.$emit('rclick', ev)
      }
      // probably causes issue - https://github.com/farin/JCloisterZone/issues/383
      // don't use z for it
      // if (ev.key === 'z') {
      //   this.overlay = true
      // }
    },

    onKeyUp (ev) {
      delete this.pressedKeys[ev.key]
      // if (ev.key === 'z') {
      //   this.overlay = false
      // }
    },

    onWheel (ev) {
      const steps = -ev.deltaY / 140.0
      this.changeZoom(ev.offsetX, ev.offsetY, steps)
    },

    onRequestZoom (change) {
      const { width, height } = this.$refs.svg.getBoundingClientRect()
      const adjustedWidth = width - 210 - 80 // approx 210px for players panel and 80 px for history
      const adjustedHeight = height - 84 // action panel
      const eventX = 80 + adjustedWidth / 2
      const eventY = 84 + adjustedHeight / 2
      this.changeZoom(eventX, eventY, change)
    },

    changeZoom (eventX, eventY, change) {
      const pointerX = (eventX - this.offsetX) / this.tileSize
      const pointerY = (eventY - this.offsetY) / this.tileSize
      this.$store.commit('board/changeZoom', change)

      this.offsetX = -(pointerX * this.tileSize - eventX)
      this.offsetY = -(pointerY * this.tileSize - eventY)
      this.adjustAfterMove()
    },

    // Pointer events rather than mouse events, so the board pans on touch as well as with a mouse
    // (a touch drag never produces mousedown/mousemove — the browser treats it as a page scroll).
    // One pointer pans; two pinch-zoom, which is the only way to zoom on a touch device: the
    // zoom-in/out commands come from the native menu and the keyboard, and mobile has neither.
    onPointerDown (ev) {
      this.pointers.set(ev.pointerId, { x: ev.screenX, y: ev.screenY, cx: ev.clientX, cy: ev.clientY })

      if (this.pointers.size === 2) {
        // second finger down: stop panning and start a pinch
        this.$store.commit('board/dragging', null)
        this.pinchDist = this.pointerDistance()
        return
      }

      if (ev.button === 0 && this.pointers.size === 1) {
        this.$store.commit('board/dragging', {
          offsetX: this.offsetX,
          offsetY: this.offsetY,
          x: ev.screenX,
          y: ev.screenY
        })
      }
    },

    onPointerMove (ev) {
      if (this.pointers.has(ev.pointerId)) {
        this.pointers.set(ev.pointerId, { x: ev.screenX, y: ev.screenY, cx: ev.clientX, cy: ev.clientY })
      }

      if (this.pointers.size === 2 && this.pinchDist) {
        const dist = this.pointerDistance()
        if (!dist || !this.pinchDist) return
        // board/changeZoom applies zoom *= 1.3**steps, so invert that for a distance ratio
        const steps = Math.log(dist / this.pinchDist) / Math.log(1.3)
        const [p1, p2] = [...this.pointers.values()]
        const rect = this.$refs.svg.getBoundingClientRect()
        this.changeZoom((p1.cx + p2.cx) / 2 - rect.left, (p1.cy + p2.cy) / 2 - rect.top, steps)
        this.pinchDist = dist // incremental: re-baseline each move
        return
      }

      const d = this.dragging
      if (d) {
        const changeX = ev.screenX - d.x
        const changeY = ev.screenY - d.y
        this.offsetX = d.offsetX + changeX
        this.offsetY = d.offsetY + changeY
        this.adjustAfterMove()
      }
    },

    pointerDistance () {
      if (this.pointers.size < 2) return 0
      const [a, b] = [...this.pointers.values()]
      return Math.hypot(a.cx - b.cx, a.cy - b.cy)
    },

    onPointerUp (ev) {
      this.pointers.delete(ev.pointerId)
      if (this.pointers.size < 2) this.pinchDist = 0
      // lifting one of two fingers must not resume a stale pan from the first finger's origin
      if (this.pointers.size === 0) this.stopDragging(ev)
    },

    stopDragging (ev) {
      if (this.dragging) {
        // let resolve first click handler
        // (it should be ignored if mouse is dragging)
        setTimeout(() => {
          Vue.nextTick(() => {
            this.offsetX = Math.round(this.offsetX)
            this.offsetY = Math.round(this.offsetY)
            this.$store.commit('board/dragging', null)
          })
        })
      }
    },

    onRightClick (ev) {
      this.$root.$emit('rclick', ev)
    },

    adjustAfterMove () {
      const { width, height } = this.$refs.svg.getBoundingClientRect()
      const adjustedWidth = width - 210 - 80 // approx 210px for players panel and 80 px for history
      const adjustedHeight = height - 84 // action panel
      const minX = parseInt(-(-0.3 + this.bounds.width + this.bounds.x) * this.tileSize + 80 + adjustedWidth / 3)
      const maxX = parseInt((-0.3 - this.bounds.x) * this.tileSize + (80 + adjustedWidth / 3 * 2))
      const minY = parseInt(-(-0.3 + this.bounds.height + this.bounds.y) * this.tileSize + 84 + adjustedHeight / 3)
      const maxY = parseInt((-0.3 - this.bounds.y) * this.tileSize + (84 + adjustedHeight / 3 * 2))
      if (this.offsetX < minX) {
        this.offsetX = minX
      }
      if (this.offsetX > maxX) {
        this.offsetX = maxX
      }
      if (this.offsetY < minY) {
        this.offsetY = minY
      }
      if (this.offsetY > maxY) {
        this.offsetY = maxY
      }
    },

    onRequestRotate () {
      this.changeRotate()
    },

    changeRotate () {
      const rotate = (this.rotate + 90) % 360
      this.$store.commit('board/changeRotate', rotate)
      this.rotate = rotate
      this.adjustAfterMove()
    },
    
  }
}
</script>

<style lang="sass" scoped>
.board
  user-select: none
  // Claim touch gestures for the board. Without this the browser consumes a drag as a page scroll
  // and a two-finger gesture as its own page zoom, so pointermove never sees them and the board
  // cannot be panned on a phone at all.
  touch-action: none
</style>
