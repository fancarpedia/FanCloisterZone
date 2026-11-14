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

import { centerOf, recenterAfterResize } from '@/utils/view-center'
import { emphasisCenter, offsetsCentering } from '@/utils/emphasis-center'
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

// Held down to pan continuously — these drive the repeat loop in onKeyDown.
const PAN_KEYS = ['a', 's', 'd', 'w']
// One action per press, however long the key is held: rotate and the hint/history toggles.
const ACTION_KEYS = ['r', 'f', 'h', 't']

// Length of one quarter-turn. Long enough to read as a turn, short enough not to delay play.
const ROTATE_DURATION = 480
// Length of the slide to a hovered history event's spot, and back.
const HOVER_PAN_DURATION = 260
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

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
    },

    // While the pointer is over the event history: the middle of the hovered event's spot on the
    // board (tile units), taken from the highlight the event shows; null otherwise.
    historyHoverCenter () {
      if (!this.$store.state.board.historyHover) return null
      return emphasisCenter(this.layers.EmphasizeLayer?.emphasis)
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
    // requestAnimationFrame handle of the running quarter-turn, and the angle it is heading for.
    // Not reactive — nothing renders from them.
    this.rotateAnimation = null
    this.rotateTarget = 0
    // rAF handle of the slide to / from a hovered history event, and where the board was before
    // the first one (null = not moved for the history). Not reactive.
    this.panAnimation = null
    this.panBeforeHover = null
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

    // Size the re-centring compares against. Not reactive - nothing renders from it.
    const svgRect = this.$refs.svg ? this.$refs.svg.getBoundingClientRect() : null
    this._viewSize = svgRect ? { width: svgRect.width, height: svgRect.height } : null

    // The work happens in a rAF: a ResizeObserver callback that writes layout synchronously
    // trips "ResizeObserver loop limit exceeded", which is exactly how this broke once before.
    this._onViewResize = () => {
      if (this._resizeFrame) return
      this._resizeFrame = requestAnimationFrame(() => {
        this._resizeFrame = null
        this.onViewResize()
      })
    }
    // BOTH, not one or the other. The observer catches the svg changing size for reasons the
    // window knows nothing about (a panel collapsing, the aside widening); the window event
    // catches the desktop app's own window being dragged, maximised or moved to another display,
    // where the observer has been seen not to fire. Either way onViewResize no-ops unless the
    // measured size actually differs, so hearing it twice costs nothing.
    if (window.ResizeObserver && this.$refs.svg) {
      this._resizeObserver = new ResizeObserver(this._onViewResize)
      this._resizeObserver.observe(this.$refs.svg)
    }
    window.addEventListener('resize', this._onViewResize)
  },

  beforeDestroy () {
    clearInterval(this.pressedKeysInterval)
    this.stopRotateAnimation()
    this.stopPanAnimation()
    if (this._resizeFrame) {
      cancelAnimationFrame(this._resizeFrame)
      this._resizeFrame = null
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
    window.removeEventListener('resize', this._onViewResize)
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerup', this.onPointerUp)
    document.removeEventListener('pointercancel', this.onPointerUp)
    document.removeEventListener('mouseleave', this.stopDragging)
    this.$root.$off('request-zoom', this.onRequestZoom)
    this.$root.$off('request-rotate', this.onRequestRotate)
  },

  watch: {
    // Hovering a history event slides its spot into the middle of the view; moving on to the next
    // event slides on from there. Between two events (no highlight for a moment) nothing moves.
    historyHoverCenter (center, prev) {
      if (!center) return
      if (prev && prev.x === center.x && prev.y === center.y) return
      if (!this.panBeforeHover) {
        this.panBeforeHover = { offsetX: this.offsetX, offsetY: this.offsetY }
      }
      this.animatePan(offsetsCentering({
        center,
        target: this.visibleCenter(),
        zoom: parseFloat(this.zoom),
        rotate: this.rotate,
        baseSize: BASE_SIZE
      }))
    },

    // Leaving the history puts the board back where the player had it.
    '$store.state.board.historyHover' (value) {
      if (!value && this.panBeforeHover) {
        const back = this.panBeforeHover
        this.panBeforeHover = null
        this.animatePan(back)
      }
    },

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
	  if ([...PAN_KEYS, ...ACTION_KEYS].includes(ev.key) && !this.$store.state.gameDialog && !this.$store.state.gameChatEdit) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) {
          return
        }

        // Rotate and the three hint toggles are ONE-SHOT: they belong on the key press, not in
        // the repeat loop below, which exists to pan smoothly while a key is held. Holding the
        // key used to re-fire them — r spun the board every 40 ms, and f/h/t flickered at the
        // keyboard's auto-repeat rate. `ev.repeat` is true for every auto-repeated keydown, so
        // this reacts once per physical press.
        if (ACTION_KEYS.includes(ev.key)) {
          if (ev.repeat) {
            return
          }
          switch (ev.key) {
            case 'r':
              this.changeRotate() // already calls adjustAfterMove()
              break
            case 'f':
              this.$store.commit('toggleGameFarmHints')
              break
            case 'h':
              this.$store.commit('toggleGameHistory')
              break
            case 't':
              this.$store.commit('toggleGameFeatureHints')
              break
          }
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
            if (this.pressedKeys.w) {
              this.offsetY -= KEY_PRESSED_OFFSET
              pressed = true
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

    // Middle of the board area the player can actually see: the side panels and the action bar
    // cover the rest of the svg, so the geometric centre of the element is not what they look at.
    visibleCenter () {
      const { width, height } = this.$refs.svg.getBoundingClientRect()
      return centerOf(width, height)
    },

    /**
     * Keep whatever the player was looking at in the middle of the window after it is resized.
     *
     * Without this the board is pinned to the svg's top-left, so widening or shrinking the window
     * slides the view sideways and the tile they were working on can drift off screen entirely.
     *
     * The centre depends only on the element's size, so the OLD centre can be recovered from the
     * size cached last time round - no need to track an anchor on every pan, which would mean a
     * getBoundingClientRect on each pointermove. The board point under the old centre is then put
     * back under the new one.
     */
    onViewResize () {
      const svg = this.$refs.svg
      if (!svg) return
      const { width, height } = svg.getBoundingClientRect()
      const prev = this._viewSize
      // nothing to preserve before the first measurement, or while the board is laid out at zero
      // (hidden tab, window minimised) - a 0-size centre would throw the view away
      if (!width || !height) return
      if (!prev || !prev.width || !prev.height) {
        this._viewSize = { width, height }
        return
      }
      if (prev.width === width && prev.height === height) return

      const moved = recenterAfterResize({
        prev,
        next: { width, height },
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        tileSize: this.tileSize
      })
      this.offsetX = moved.offsetX
      this.offsetY = moved.offsetY
      this.adjustAfterMove()

      this._viewSize = { width, height }
    },

    onRequestZoom (change) {
      const { x, y } = this.visibleCenter()
      this.changeZoom(x, y, change)
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
      // The player takes the board into their own hands (e.g. on a touch screen, where a tapped
      // history event stays "hovered"): it stays wherever they leave it, no slide back later.
      this.stopPanAnimation()
      this.panBeforeHover = null
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
      // The board's extent ON SCREEN, relative to its origin (offsetX, offsetY). With the board
      // turned, that is the bounding box of its rotated corners: after 90° a row of tiles runs
      // vertically, so the limits must follow it (they used the unrotated columns / rows, which
      // pinned a turned board and kept it from scrolling along its new long side). At 0° this is
      // exactly the old x..x+width / y..y+height.
      const { left, right, top, bottom } = this.screenExtent()
      const edge = 0.3 * this.tileSize
      const minX = parseInt(-(right - edge) + 80 + adjustedWidth / 3)
      const maxX = parseInt(-(left + edge) + (80 + adjustedWidth / 3 * 2))
      const minY = parseInt(-(bottom - edge) + 84 + adjustedHeight / 3)
      const maxY = parseInt(-(top + edge) + (84 + adjustedHeight / 3 * 2))
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

    // The bounding box of the board's tiles in screen pixels, relative to the board origin, with the
    // current rotation applied the same way the group transform and applyRotation() do:
    // (dx, dy) → (dx·cos − dy·sin, dx·sin + dy·cos).
    screenExtent () {
      const ts = this.tileSize
      const { x, y, width, height } = this.bounds
      const rad = (this.rotate || 0) * Math.PI / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const xs = []
      const ys = []
      for (const [cx, cy] of [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]) {
        const dx = cx * ts
        const dy = cy * ts
        xs.push(dx * cos - dy * sin)
        ys.push(dx * sin + dy * cos)
      }
      return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
    },

    onRequestRotate () {
      this.changeRotate()
    },

    changeRotate () {
      // A turn already running is snapped to its target first, so quick taps add up to 180°
      // instead of restarting from a half-finished angle.
      this.stopRotateAnimation(true)

      const from = this.rotate
      const center = this.visibleCenter()
      const origin = { x: this.offsetX, y: this.offsetY }

      if (this.prefersReducedMotion()) {
        this.applyRotation(from, 90, center, origin)
        this.adjustAfterMove()
        return
      }

      this.rotateTarget = (from + 90) % 360
      const start = performance.now()
      const step = now => {
        const t = Math.min(1, (now - start) / ROTATE_DURATION)
        this.applyRotation(from, 90 * easeInOutCubic(t), center, origin)
        if (t < 1) {
          this.rotateAnimation = requestAnimationFrame(step)
        } else {
          this.rotateAnimation = null
          this.adjustAfterMove() // clamp once, at rest — clamping mid-turn fights the animation
        }
      }
      this.rotateAnimation = requestAnimationFrame(step)
    },

    /**
     * Put the board at `from + delta` degrees while keeping whatever sits under `center` in place.
     *
     * The group transform is `rotate(r Ox Oy) translate(Ox Oy) scale(z)`, so a board point p lands
     * at O + R(r)·(z·p) with O = (offsetX, offsetY) — the pivot is wherever the board's own 0,0
     * currently sits, which drifts with every pan. Holding the centre still means moving the origin
     * to O' = C - R(delta)·(C - O), where O is the origin as it was when the turn began.
     */
    applyRotation (from, delta, center, origin) {
      const rad = delta * Math.PI / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const dx = center.x - origin.x
      const dy = center.y - origin.y
      this.offsetX = center.x - (dx * cos - dy * sin)
      this.offsetY = center.y - (dx * sin + dy * cos)

      const rotate = (from + delta) % 360
      this.rotate = rotate
      // Committed every frame, not just at the end: the meeples, score bullets and anything else
      // using counterBoardRotation() have to turn with the board to stay upright all the way.
      this.$store.commit('board/changeRotate', rotate)
    },

    /**
     * Ends an in-flight turn. With `snap`, finishes the quarter-turn it was heading for, rather
     * than the nearest one — a second tap at 30° through must still land on 90°, not fall back
     * to 0°, or quick taps would cancel each other out.
     */
    stopRotateAnimation (snap = false) {
      if (!this.rotateAnimation) {
        return
      }
      cancelAnimationFrame(this.rotateAnimation)
      this.rotateAnimation = null
      if (snap) {
        const remaining = (this.rotateTarget - this.rotate + 360) % 360
        this.applyRotation(this.rotate, remaining, this.visibleCenter(),
          { x: this.offsetX, y: this.offsetY })
      }
    },

    // Slide the board to the given offsets (or jump, with reduced motion).
    animatePan (to) {
      this.stopPanAnimation()
      if (this.prefersReducedMotion()) {
        this.offsetX = to.offsetX
        this.offsetY = to.offsetY
        return
      }
      const from = { offsetX: this.offsetX, offsetY: this.offsetY }
      const start = performance.now()
      const step = now => {
        const t = Math.min(1, (now - start) / HOVER_PAN_DURATION)
        const k = easeInOutCubic(t)
        this.offsetX = from.offsetX + (to.offsetX - from.offsetX) * k
        this.offsetY = from.offsetY + (to.offsetY - from.offsetY) * k
        this.panAnimation = t < 1 ? requestAnimationFrame(step) : null
      }
      this.panAnimation = requestAnimationFrame(step)
    },

    stopPanAnimation () {
      if (this.panAnimation) {
        cancelAnimationFrame(this.panAnimation)
        this.panAnimation = null
      }
    },

    prefersReducedMotion () {
      return typeof window !== 'undefined' && !!window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
