<template>
  <div v-if="chatEnabled" class="setup-chat-root">
    <!-- Collapsed launcher: same red bullet as the in-game chat -->
    <button
      v-show="!open"
      class="chat-launcher"
      :style="bulletRight('game-chat') ? { right: bulletRight('game-chat') } : {}"
      :title="$t('chat.open') || 'Chat'"
      @mousedown="bulletDragStart('game-chat', $event)"
      @click="openChat"
    >
      <v-icon class="chat-launcher-icon color-overlay">fas fa-comments</v-icon>
      <span v-if="unread > 0" class="chat-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <!-- Expanded: the pre-start (slot-based) game chat in a floating panel (follows the bullet) -->
    <div v-show="open" class="setup-chat-panel" :style="panelStyle">
      <button
        class="chat-close"
        :title="$t('chat.close') || 'Close'"
        @click="closeChat"
      >
        <v-icon class="color-overlay">fas fa-times</v-icon>
      </button>
      <OpenGameChat />
    </div>
  </div>
</template>

<script>
import isArray from 'lodash/isArray'
import { mapState } from 'vuex'

import ChatBulletDragMixin from '@/components/ChatBulletDragMixin'
import OpenGameChat from '@/components/game-setup/OpenGameChat'

// Floating game-chat launcher for the game-setup page while editing an ONLINE game's setup
// (change-setup from the slot page). Before the game starts messages are slot-based, so the
// panel embeds OpenGameChat (the slot page's chat) instead of the players-based GameChat.
export default {
  components: {
    OpenGameChat
  },

  mixins: [ChatBulletDragMixin],

  data () {
    return {
      open: false,
      readCount: 0
    }
  },

  computed: {
    ...mapState({
      gameChat: state => state.game.gameChat
    }),

    chatEnabled () {
      return isArray(this.gameChat)
    },

    unread () {
      if (!this.chatEnabled || this.open) return 0
      return Math.max(0, this.gameChat.length - this.readCount)
    },

    // the expanded panel opens where the bullet sits (clamped so it stays in the window)
    panelStyle () {
      const right = this.bulletRight('game-chat')
      if (!right) return {}
      const max = Math.max(16, window.innerWidth - 396)
      return { right: `${Math.min(parseInt(right), max)}px` }
    }
  },

  watch: {
    gameChat () {
      if (this.open) this.markRead()
    }
  },

  methods: {
    openChat () {
      if (!this.bulletClickAllowed()) return // the click just ended a drag
      this.open = true
      this.markRead()
    },

    closeChat () {
      this.markRead()
      this.open = false
    },

    markRead () {
      this.readCount = this.chatEnabled ? this.gameChat.length : 0
    }
  }
}
</script>

<style lang="sass" scoped>
.setup-chat-root
  .chat-launcher
    position: fixed
    bottom: 20px
    right: 16px
    z-index: 120
    width: 56px
    height: 56px
    border-radius: 50%
    background: #d32f2f
    border: none
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4)
    cursor: pointer
    display: flex
    align-items: center
    justify-content: center
    transition: background 0.15s ease, transform 0.1s ease

    &:hover
      background: #e53935

    &:active
      transform: scale(0.95)

    .chat-launcher-icon
      color: white
      font-size: 24px

    .chat-badge
      position: absolute
      top: -4px
      right: -4px
      min-width: 22px
      height: 22px
      padding: 0 5px
      border-radius: 11px
      background: white
      color: #d32f2f
      border: 2px solid #d32f2f
      font-size: 12px
      font-weight: bold
      line-height: 18px
      text-align: center
      box-sizing: border-box

  .setup-chat-panel
    position: fixed
    bottom: 20px
    right: 16px
    z-index: 120
    width: 380px
    height: 420px
    padding: 30px 10px 10px
    border-radius: 8px
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4)
    display: flex
    flex-direction: column

    +theme using ($theme)
      background: map-get($theme, 'cards-bg')
      color: map-get($theme, 'cards-text')

    ::v-deep .open-game-chat
      flex: 1 1 0
      min-height: 0

  .chat-close
    position: absolute
    top: 4px
    right: 6px
    background: none
    border: none
    cursor: pointer

    .v-icon
      font-size: 18px

      +theme using ($theme)
        color: map-get($theme, 'gray-text-color')
</style>
