<template>
  <!-- Live list of the game windows currently open. Drop <OpenGameWindows /> on any page; it keeps
       itself in sync via the main-process 'game-windows.changed' broadcast. -->
  <div class="open-windows-root">
    <div v-if="!windows.length" class="ow-empty">{{ $t('open-windows.empty') }}</div>

    <ul v-else class="ow-list">
      <li
        v-for="w in windows"
        :key="w.id"
        class="ow-item"
        :title="$t('open-windows.focus')"
        @click="focus(w)"
      >
        <div class="ow-head">
          <span class="ow-dot" :class="dotClass(w)" />
          <span class="ow-title">{{ label(w) }}</span>
          <span
            v-if="w.progress"
            class="ow-progress"
            :title="$t('open-windows.progress')"
          >{{ w.progress.used }}/{{ w.progress.total }}</span>
          <button class="ow-close" :title="$t('open-windows.close')" @click.stop="close(w)">
            <v-icon>fas fa-times</v-icon>
          </button>
        </div>
        <div v-if="w.key" class="ow-key">{{ w.key }}</div>
        <GameSetupOverviewInline
          v-if="w.setup && w.setup.sets && w.setup.elements"
          class="ow-setup"
          :sets="w.setup.sets"
          :elements="w.setup.elements"
          :tile-overrides="w.setup.tileOverrides"
        />
      </li>
    </ul>
  </div>
</template>

<script>
import GameSetupOverviewInline from '@/components/game-setup/overview/GameSetupOverviewInline'

export default {
  components: {
    GameSetupOverviewInline
  },

  data () {
    return {
      allWindows: [],
      myId: null,
      unsubscribe: null
    }
  },

  computed: {
    // Exclude this window itself (a game window viewing the list shouldn't list itself).
    windows () {
      return this.allWindows.filter(w => w.id !== this.myId)
    }
  },

  async mounted () {
    this.myId = this.$windows.myWindowId()
    await this.refresh()
    this.unsubscribe = this.$windows.onWindowsChanged(list => { this.allWindows = list })
    // Closing a game window focuses the main window — re-query on focus as a safety net in
    // case the main-process 'game-windows.changed' broadcast was missed.
    this._onFocus = () => { this.refresh() }
    window.addEventListener('focus', this._onFocus)
  },

  beforeDestroy () {
    if (this.unsubscribe) this.unsubscribe()
    if (this._onFocus) window.removeEventListener('focus', this._onFocus)
  },

  methods: {
    async refresh () {
      // myId may not have resolved yet at mount — pick it up here too.
      if (this.myId == null) this.myId = this.$windows.myWindowId()
      this.allWindows = await this.$windows.listGameWindows()
    },

    // Bullet colour = the active player's colour (global .color-N.color-bg classes), blinking when
    // it is my turn. Falls back to a neutral idle dot before any player is active (e.g. setup phase).
    dotClass (w) {
      const a = w.active
      if (a && a.slot != null) {
        return ['color', 'color-' + a.slot, 'color-bg', { blink: a.isMe }]
      }
      return ['idle']
    },

    label (w) {
      const key = {
        'new-local': 'open-windows.kind.local',
        'load': 'open-windows.kind.local',
        'load-setup': 'open-windows.kind.local',
        'create-online': 'open-windows.kind.online',
        'join-online': 'open-windows.kind.online'
      }[w.intentKind]
      return key ? this.$t(key) : (w.title || this.$t('open-windows.kind.game'))
    },

    focus (w) {
      this.$windows.focusGameWindow(w.id)
    },

    close (w) {
      this.$windows.closeGameWindow(w.id)
    }
  }
}
</script>

<style lang="sass" scoped>
.open-windows-root
  display: flex
  flex-direction: column
  min-height: 0

.ow-empty
  opacity: 0.6
  font-style: italic
  font-size: 13px
  padding: 4px 0

.ow-list
  list-style: none
  margin: 0
  padding: 0
  overflow-y: auto

.ow-item
  padding: 8px 10px
  margin-bottom: 6px
  border-radius: 6px
  cursor: pointer
  font-size: 13px

  +theme using ($theme)
    background-color: map-get($theme, 'board-bg')
    color: map-get($theme, 'text-color')

  &:hover
    +theme using ($theme)
      background-color: map-get($theme, 'cards-hover-bg', map-get($theme, 'board-bg'))
    filter: brightness(1.1)

  .ow-head
    display: flex
    align-items: center
    gap: 8px

  .ow-dot
    flex: 0 0 auto
    width: 11px
    height: 11px
    border-radius: 50%
    // outline so pale player colours (white/yellow) stay visible on any background
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3)

    &.idle
      background: #9e9e9e

    &.blink
      animation: ow-blink 1s ease-in-out infinite

  .ow-title
    flex: 1 1 auto
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  .ow-progress
    flex: 0 0 auto
    font-family: monospace
    font-size: 12px
    opacity: 0.85
    padding: 1px 6px
    border-radius: 8px

    +theme using ($theme)
      background-color: map-get($theme, 'cards-bg')

  .ow-close
    flex: 0 0 auto
    border: none
    background: transparent
    cursor: pointer
    opacity: 0.6

    &:hover
      opacity: 1

    .v-icon
      font-size: 14px

  .ow-key
    margin-top: 2px
    font-family: monospace
    font-size: 13px
    letter-spacing: 1px
    opacity: 0.7
    text-transform: uppercase

  // The inline overview is a fixed 360px grid — zoom it down to fit the narrow aside (zoom reflows
  // in Chromium/Electron, so unlike transform:scale it leaves no empty space below the row).
  .ow-setup
    margin-top: 6px
    zoom: 0.78

@keyframes ow-blink
  0%, 100%
    opacity: 1
  50%
    opacity: 0.15
</style>
