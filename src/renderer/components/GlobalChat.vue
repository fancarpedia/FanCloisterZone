<template>
  <!-- inline: an always-open panel (lobby). overlay: a blue launcher ("bullet") that opens the panel
       — drop <GlobalChat /> on any online page; it hides itself when not connected online. -->
  <div v-if="visible" :class="['global-chat-root', inline ? 'inline' : 'overlay', { 'overlay-left': !inline && left }]" :style="overlayVars">
    <button
      v-if="!inline"
      v-show="!open"
      class="gc-launcher"
      :title="$t('global-chat.title')"
      @click="openChat"
    >
      <v-icon class="gc-launcher-icon">fas fa-globe</v-icon>
      <span v-if="unread > 0" class="gc-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <div v-show="inline || open" class="gc-panel">
      <div class="gc-header">
        <span class="gc-title"><span class="gc-bullet" />{{ $t('global-chat.title') }}</span>
        <button v-if="!inline" class="gc-close" :title="$t('chat.close') || 'Close'" @click="open = false">
          <v-icon>fas fa-times</v-icon>
        </button>
      </div>

      <div ref="messages" class="gc-messages">
        <div v-if="!messages.length" class="gc-empty">{{ $t('global-chat.empty') }}</div>
        <div v-for="(m, i) in messages" :key="i" class="gc-message">
          <span class="gc-bullet" />
          <span class="gc-name">{{ m.name || '?' }}</span>
          <span class="gc-time">{{ time(m) }}</span>
          <span class="gc-text">{{ m.message }}</span>
        </div>
      </div>

      <div class="gc-input">
        <v-text-field
          v-model="newMessage"
          dense
          hide-details
          :label="$t('global-chat.new-message')"
          @focus="editing(true)"
          @blur="editing(false)"
          @keydown.stop
          @keydown.enter="send"
        />
        <button class="gc-send" :title="$t('global-chat.send')" @click="send">
          <v-icon>fas fa-paper-plane</v-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import isNil from 'lodash/isNil'

export default {
  props: {
    // inline = always-open panel (lobby); otherwise a collapsible blue overlay ("bullet").
    inline: { type: Boolean, default: false },
    // CSS `right` offset for the overlay bullet/panel (e.g. in-game: left of the red game-chat button).
    right: { type: String, default: '20px' },
    // When set, anchor the overlay bullet/panel to the bottom-LEFT at this offset instead of the
    // bottom-right (e.g. take-slots page, where the chat send button occupies the bottom-right).
    left: { type: String, default: null }
  },

  data () {
    return { open: false, newMessage: '', readCount: 0 }
  },

  computed: {
    ...mapState({
      messages: state => state.globalChat.messages,
      locale: state => state.settings.locale,
      connectionType: state => state.networking.connectionType
    }),

    // Global chat is ONLINE-ONLY (server-broadcast): hidden in local/offline games, both as the
    // inline lobby panel and as the bullet. (connectionType is 'online' only for online play.)
    visible () {
      return this.connectionType === 'online'
    },

    overlayVars () {
      if (this.inline) return {}
      return this.left ? { '--gc-left': this.left } : { '--gc-right': this.right }
    },

    unread () {
      return Math.max(0, this.messages.length - this.readCount)
    }
  },

  watch: {
    messages () {
      if (this.inline || this.open) this.readCount = this.messages.length
      this.scrollToBottom()
    }
  },

  mounted () {
    this.readCount = this.messages.length
    this.scrollToBottom()
  },

  methods: {
    openChat () {
      this.open = true
      this.readCount = this.messages.length
      this.scrollToBottom()
    },
    editing (val) {
      // Suppress the game's spacebar/keyboard shortcuts while typing in-game.
      this.$store.commit('gameChatEdit', val ? true : null)
    },
    send () {
      const text = this.newMessage.trim()
      if (!text) return
      this.$store.dispatch('globalChat/send', text)
      this.newMessage = ''
    },
    time (m) {
      if (isNil(m.timestamp)) return ''
      return new Date(m.timestamp * 1000).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' })
    },
    scrollToBottom () {
      this.$nextTick(() => {
        const el = this.$refs.messages
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }
}
</script>

<style lang="sass" scoped>
$gc-blue: #2196f3

.gc-bullet
  display: inline-block
  width: 9px
  height: 9px
  border-radius: 50%
  background: $gc-blue
  margin-right: 6px
  flex: 0 0 auto

.overlay
  .gc-launcher
    position: fixed
    bottom: 20px
    right: var(--gc-right, 20px)
    z-index: 6
    width: 56px
    height: 56px
    border-radius: 50%
    background: $gc-blue
    border: none
    box-shadow: 0 2px 8px rgba(0,0,0,0.4)
    cursor: pointer
    display: flex
    align-items: center
    justify-content: center

    &:hover
      background: #42a5f5

    .gc-launcher-icon
      color: white
      font-size: 24px

    .gc-badge
      position: absolute
      top: -4px
      right: -4px
      min-width: 22px
      height: 22px
      padding: 0 5px
      border-radius: 11px
      background: white
      color: $gc-blue
      border: 2px solid $gc-blue
      font-size: 12px
      font-weight: bold
      line-height: 18px
      text-align: center
      box-sizing: border-box

  .gc-panel
    position: fixed
    bottom: 20px
    right: var(--gc-right, 20px)
    z-index: 6
    width: 360px
    height: 280px
    display: flex
    flex-direction: column
    border-radius: 8px
    background: rgba(0,0,0,0.6)
    box-shadow: 0 2px 10px rgba(0,0,0,0.4)

// anchor to the bottom-left instead of bottom-right (overrides the .overlay right offset)
.overlay-left
  .gc-launcher, .gc-panel
    right: auto
    left: var(--gc-left, 20px)

.inline
  // fills its container (e.g. the lobby's right-hand aside) rather than a fixed height
  flex-direction: column
  flex: 1 1 0
  min-height: 0

  .gc-panel
    flex: 1 1 0
    min-height: 0
    display: flex
    flex-direction: column
    border-radius: 8px

    +theme using ($theme)
      background-color: map-get($theme, 'cards-bg')

.gc-panel
  .gc-header
    display: flex
    align-items: center
    justify-content: space-between
    padding: 8px 12px
    border-bottom: 2px solid $gc-blue

    .gc-title
      display: flex
      align-items: center
      font-weight: 500
      text-transform: uppercase
      font-size: 13px

    .gc-close
      border: none
      background: transparent
      cursor: pointer

      .v-icon
        font-size: 16px

  .gc-messages
    flex: 1 1 auto
    overflow-y: auto
    padding: 8px 12px

    .gc-empty
      opacity: 0.6
      font-style: italic

  .gc-message
    display: flex
    align-items: baseline
    gap: 5px
    margin-bottom: 4px
    font-size: 13px

    .gc-name
      font-weight: 600
      color: $gc-blue

    .gc-time
      color: #999
      font-size: 11px
      white-space: nowrap

    .gc-text
      word-break: break-word

  .gc-input
    display: flex
    align-items: center
    gap: 6px
    padding: 4px 12px 8px

    .gc-send
      border: none
      background: $gc-blue
      color: white
      border-radius: 5px
      padding: 6px 10px
      cursor: pointer

      &:hover
        background: #42a5f5
</style>
