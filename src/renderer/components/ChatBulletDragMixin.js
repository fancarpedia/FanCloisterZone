// Makes chat launcher bullets ("red" game chat, "blue" global chat) draggable along the
// bottom line of the window. Only the horizontal position changes; it is persisted per
// bullet key in settings.chatBulletOffsets, so a bullet keeps its place across the
// game-setup / open-game / game pages.
//
// A bullet also steps aside from the pre-draw hand box (PreDrawHand.vue): while the box covers it,
// the bullet moves next to the box — to its left, or to its right when there is no room on the
// left — and goes back to its own place once the box moves away. A component opts in by listing
// its bullets in `bulletAvoidTargets` (key + CSS selector of the launcher element).
//
// An OPEN chat box does the same (`boxAvoidTargets`): when the window is wide enough for the hand
// box and the chat box side by side, it steps aside horizontally; otherwise it rises to sit just
// above the hand box, and drops back to the bottom once the hand box no longer covers it (moved
// away, or smaller). Opening / closing any chat re-checks every bullet and box ('chat-layout-
// changed' on $root), as do window resizes and screen rotations.
const AVOID_GAP = 8

export default {
  data () {
    return {
      bulletDragOffsets: {}, // live values during a drag (px from the window's right edge)
      bulletDragMoved: false,
      bulletDragging: null, // key of the bullet being dragged right now
      bulletAvoid: {}, // key -> px from the right edge while stepping aside from the hand box
      bulletDefaultRight: {}, // key -> measured CSS-default place (bullets never dragged)
      boxAvoid: {}, // chat-box key -> { right, bottom } (px) while stepping aside from the hand box
      boxBase: {} // chat-box key -> its own measured place { right, bottom, width, height }
    }
  },

  computed: {
    savedBulletOffsets () {
      return this.$store.state.settings.chatBulletOffsets || {}
    },
    bulletHandRect () {
      return this.$store.state.predraw ? this.$store.state.predraw.handRect : null
    }
  },

  watch: {
    bulletHandRect () {
      this.$nextTick(this.refreshBulletAvoid)
    },
    savedBulletOffsets () {
      this.$nextTick(this.refreshBulletAvoid)
    }
  },

  mounted () {
    if (!this.bulletAvoidTargets && !this.boxAvoidTargets) return
    this._bulletAvoidResize = () => {
      // the window changed: forget the measured box places, measure them afresh
      this.boxAvoid = {}
      this.boxBase = {}
      this.$nextTick(this.refreshBulletAvoid)
    }
    this._bulletLayoutChanged = () => this.$nextTick(this.refreshBulletAvoid)
    window.addEventListener('resize', this._bulletAvoidResize)
    window.addEventListener('orientationchange', this._bulletAvoidResize)
    this.$root.$on('chat-layout-changed', this._bulletLayoutChanged)
    this.$nextTick(this.refreshBulletAvoid)
  },

  beforeDestroy () {
    if (this._bulletAvoidResize) {
      window.removeEventListener('resize', this._bulletAvoidResize)
      window.removeEventListener('orientationchange', this._bulletAvoidResize)
      this.$root.$off('chat-layout-changed', this._bulletLayoutChanged)
    }
  },

  methods: {
    // current CSS `right` for the bullet, or null when it was never dragged (use the default)
    bulletRight (key) {
      if (this.bulletDragging !== key && this.bulletAvoid[key] !== undefined) {
        return `${this.bulletAvoid[key]}px` // stepping aside from the hand box
      }
      const v = this.bulletDragOffsets[key] !== undefined
        ? this.bulletDragOffsets[key]
        : this.savedBulletOffsets[key]
      return (v === undefined || v === null) ? null : `${v}px`
    },

    bulletDragStart (key, ev) {
      if (ev.button !== 0) return
      const rect = ev.currentTarget.getBoundingClientRect()
      const startRight = window.innerWidth - rect.right
      const startX = ev.clientX
      this.bulletDragMoved = false
      const onMove = mv => {
        const dx = mv.clientX - startX
        if (!this.bulletDragMoved && Math.abs(dx) < 5) return // click tolerance
        this.bulletDragMoved = true
        this.bulletDragging = key
        const right = Math.min(Math.max(startRight - dx, 8), window.innerWidth - rect.width - 8)
        this.$set(this.bulletDragOffsets, key, Math.round(right))
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        this.bulletDragging = null
        this.$nextTick(this.refreshBulletAvoid)
        if (this.bulletDragMoved && this.bulletDragOffsets[key] !== undefined) {
          this.$store.dispatch('settings/update', {
            chatBulletOffsets: { ...this.savedBulletOffsets, [key]: this.bulletDragOffsets[key] }
          })
        }
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },

    // re-check every opted-in bullet and chat box against the hand box
    refreshBulletAvoid () {
      const find = selector => this.$el && this.$el.querySelector ? this.$el.querySelector(selector) : null
      ;(this.bulletAvoidTargets || []).forEach(([key, selector]) => this.updateBulletAvoid(key, find(selector)))
      ;(this.boxAvoidTargets || []).forEach(([key, selector]) => this.updateBoxAvoid(key, find(selector)))
    },

    // tell every chat (bullets and boxes) to re-check — after a chat opened or closed
    announceChatLayout () {
      this.$root.$emit('chat-layout-changed')
    },

    // inline style for an open chat box that steps aside ({} = its own place)
    boxAvoidStyle (key) {
      const a = this.boxAvoid[key]
      if (!a) return {}
      return { left: 'auto', right: `${a.right}px`, bottom: `${a.bottom}px` }
    },

    updateBoxAvoid (key, el) {
      if (this.boxAvoidPaused && this.boxAvoidPaused(key)) return // e.g. being dragged
      const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null
      const hand = this.bulletHandRect
      if (!rect || !rect.width) { // closed / hidden
        this.$delete(this.boxAvoid, key)
        this.$delete(this.boxBase, key)
        return
      }
      const W = window.innerWidth
      const H = window.innerHeight
      // its own place: measured while not stepping aside, remembered while it is
      if (this.boxAvoid[key] === undefined || !this.boxBase[key]) {
        this.$set(this.boxBase, key, {
          right: Math.round(W - rect.right),
          bottom: Math.round(H - rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        })
      }
      const base = this.boxBase[key]
      if (!hand) {
        this.$delete(this.boxAvoid, key)
        return
      }
      const right = W - base.right
      const left = right - base.width
      const bottom = H - base.bottom
      const top = bottom - base.height
      const covered = hand.left < right + AVOID_GAP && hand.right > left - AVOID_GAP &&
        hand.top < bottom + AVOID_GAP && hand.bottom > top - AVOID_GAP
      if (!covered) {
        this.$delete(this.boxAvoid, key)
        return
      }
      // wide window: beside the hand box (left of it, else right of it), on its own bottom line
      const handWidth = hand.right - hand.left
      if (W >= handWidth + base.width + 3 * AVOID_GAP) {
        if (hand.left - AVOID_GAP - base.width >= AVOID_GAP) {
          this.$set(this.boxAvoid, key, { right: Math.round(W - hand.left + AVOID_GAP), bottom: base.bottom })
          return
        }
        if (W - hand.right - AVOID_GAP - base.width >= AVOID_GAP) {
          this.$set(this.boxAvoid, key, { right: Math.round(W - hand.right - AVOID_GAP - base.width), bottom: base.bottom })
          return
        }
      }
      // narrow window (or no room beside it): just above the hand box, in its own column
      this.$set(this.boxAvoid, key, { right: base.right, bottom: Math.round(H - hand.top + AVOID_GAP) })
    },

    updateBulletAvoid (key, el) {
      if (this.bulletDragging === key) return
      const hand = this.bulletHandRect
      const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null
      if (!rect || !rect.width) {
        this.$delete(this.bulletAvoid, key)
        return
      }
      const W = window.innerWidth
      // the bullet's own place (not where it may be stepping aside to right now)
      let base = this.bulletDragOffsets[key] !== undefined ? this.bulletDragOffsets[key] : this.savedBulletOffsets[key]
      if (base === undefined || base === null) {
        if (this.bulletAvoid[key] === undefined) this.$set(this.bulletDefaultRight, key, Math.round(W - rect.right))
        base = this.bulletDefaultRight[key]
      }
      if (!hand || base === undefined) {
        this.$delete(this.bulletAvoid, key)
        return
      }
      const width = rect.width
      const right = W - base
      const left = right - width
      const covered = hand.top < rect.bottom && hand.bottom > rect.top &&
        hand.left < right + AVOID_GAP && hand.right > left - AVOID_GAP
      if (!covered) {
        this.$delete(this.bulletAvoid, key)
        return
      }
      // to the left of the box; to its right when the left has no room
      let target = W - hand.left + AVOID_GAP
      if (W - target - width < AVOID_GAP) target = W - hand.right - AVOID_GAP - width
      this.$set(this.bulletAvoid, key, Math.round(target))
    },

    // the click event fires after the mouseup ending a drag — swallow that click
    bulletClickAllowed () {
      if (this.bulletDragMoved) {
        this.bulletDragMoved = false
        return false
      }
      return true
    }
  }
}
