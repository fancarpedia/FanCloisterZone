// Makes chat launcher bullets ("red" game chat, "blue" global chat) draggable along the
// bottom line of the window. Only the horizontal position changes; it is persisted per
// bullet key in settings.chatBulletOffsets, so a bullet keeps its place across the
// game-setup / open-game / game pages.
export default {
  data () {
    return {
      bulletDragOffsets: {}, // live values during a drag (px from the window's right edge)
      bulletDragMoved: false
    }
  },

  computed: {
    savedBulletOffsets () {
      return this.$store.state.settings.chatBulletOffsets || {}
    }
  },

  methods: {
    // current CSS `right` for the bullet, or null when it was never dragged (use the default)
    bulletRight (key) {
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
        const right = Math.min(Math.max(startRight - dx, 8), window.innerWidth - rect.width - 8)
        this.$set(this.bulletDragOffsets, key, Math.round(right))
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        if (this.bulletDragMoved && this.bulletDragOffsets[key] !== undefined) {
          this.$store.dispatch('settings/update', {
            chatBulletOffsets: { ...this.savedBulletOffsets, [key]: this.bulletDragOffsets[key] }
          })
        }
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
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
