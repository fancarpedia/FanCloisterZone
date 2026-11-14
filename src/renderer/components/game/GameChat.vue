<template>
  <div class="game-chat-root" v-if="chatEnabled">
    <!-- Collapsed launcher: red button with chat icon + unread badge -->
    <!-- web build: the launcher stays while the chat is open (the chat opens ABOVE it, so the
         global chat's blue launcher beside it stays reachable); a click toggles the chat -->
    <button
      v-show="!open || anchored"
      class="chat-launcher"
      :class="{ active: open }"
      :style="bulletRight('game-chat') ? { right: bulletRight('game-chat') } : {}"
      :title="$t('chat.open') || 'Chat'"
      @mousedown="bulletDragStart('game-chat', $event)"
      @click="onLauncherClick"
    >
      <v-icon class="chat-launcher-icon color-overlay">fas fa-comments</v-icon>
      <span v-if="unread > 0" class="chat-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <!-- Expanded chat (movable) -->
    <div
      v-show="open"
      class="game-chat"
      :class="{ anchored }"
      :style="positionStyle"
      @mousedown="startDrag"
    >
      <!-- same header as the global chat (GlobalChat.vue .gc-header), in the game chat's red -->
      <div class="chat-header">
        <span class="chat-title"><span class="chat-bullet" />{{ $t('chat.game-chat') }}</span>
        <button
          class="chat-close"
          :title="$t('chat.close') || 'Close'"
          @mousedown.stop
          @click="closeChat"
        >
          <v-icon>fas fa-times</v-icon>
        </button>
      </div>
      <!-- messages and input laid out like the global chat (GlobalChat.vue .gc-messages /
           .gc-input); the author marker is the seat's colour bullet -->
      <div ref="gameChatMessages" class="chat-messages">
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="chat-message"
          :class="{ 'author-inactive': !isMessageAuthorActive(m) }"
        >
          <span :class="'chat-author color-bg-important color-' + getMessageSlotColor(m)" />
          <span class="chat-time">{{ getMessageTime(m) }}</span>
          <span class="chat-text">{{ m.message }}</span>
        </div>
        <div v-if="sentMessage" class="chat-message pending">
          <span class="chat-text">{{ sentMessage }}</span>
        </div>
        <div ref="endOfChat" />
      </div>
      <div class="chat-input">
        <v-text-field
          ref="chatMessage"
          v-model="newMessage"
          dense
          hide-details
          :label="$t('chat.new-message')"
          @mousedown.stop
          @focus="joinMessage"
          @blur="leaveMessage"
          @keydown="keyDown"
          @keydown.enter="sendMessage"
        />
        <!-- one send button per local player (hotseat), in that player's colour -->
        <button
          v-for="p in localPlayers"
          :key="p"
          :class="'chat-send color-bg-important color-overlay color-' + getPlayerSlotColor(p)"
          :title="$t('chat.send')"
          @mousedown.stop
          @click="sendMessageByPlayer(p)"
        >
          <v-icon class="color-overlay">fas fa-paper-plane</v-icon>
        </button>
      </div>
    </div>

    <audio ref="beep" :src="BEEP_URL" />
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { app } from 'electron'

import isArray from 'lodash/isArray'
import isEqual from 'lodash/isEqual'
import isNil from 'lodash/isNil'

import ChatBulletDragMixin from '@/components/ChatBulletDragMixin'
import { isWeb } from '@/utils/version'

export default {
  mixins: [ChatBulletDragMixin],

  data () {
    const src = require('~/assets/beep.wav')
    return {
      dragging: false,
      open: false,
      readCount: 0,
      newMessage: '',
      // keep in step with .game-chat width / height (the global chat's panel size)
      CHAT_WIDTH: 360,
      CHAT_HEIGHT: 280,
      offset: {
        x: 0,
        y: 0
      },
      position: {
        right: null,
        bottom: null
      },
      sentMessage: null,
      // web build: the chat opens above its launcher instead of a free-floating, draggable box
      // (the global chat's launcher sits beside it in the game, both stay visible)
      anchored: isWeb(),
      BEEP_URL: src?.default ? src.default : src // hack, Nuxt doesn't convert asset to string directly (at least in dev mode)
    }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    ...mapState({
      chat: state => state.game.gameChat,
      players: state => state.game.players,
      savedPosition: state => state.settings.chatPosition,
      locale: state => state.settings.locale,
      slots: state => state.game.slots,
      sessionId: state => state.networking.sessionId,
      beepEnabled: state => state.settings.beep
    }),

    chatEnabled() {
      return isArray(this.chat)
    },

    messages() {
      return this.chat
    },

    unread() {
      if (!this.chatEnabled) return 0
      return Math.max(0, this.messages.length - this.readCount)
    },

    localPlayers() {
      return this.players
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => player.sessionId === this.sessionId)
        .map(({ index }) => index)
    },

    positionStyle() {
      const style = {}
      if (this.anchored) {
        // right edge on the launcher's right edge; vertical place from the CSS (.anchored)
        const right = this.bulletRight('game-chat')
        if (right) style.right = right
        return style
      }

      if (this.position.right != null) style.right = this.position.right + 'px'
      if (this.position.bottom != null) style.bottom = this.position.bottom + 'px'

      return style
    }
  },

  mounted() {
    const saved = this.savedPosition
    if (saved && typeof saved.right === 'number' && typeof saved.bottom === 'number') {
      this.position.right = saved.right
      this.position.bottom = saved.bottom
    } else {
      this.resetToDefaultPosition()
    }
    this.clampPosition()

    if (this.chatEnabled) {
      // treat any pre-existing history as already read
      this._chatInited = true
      this.prevLen = this.messages.length
      this.readCount = this.messages.length
    } else {
      this._chatInited = false
      this.prevLen = 0
    }

    window.addEventListener('resize', this.onWindowResize)
    this.$root.$on('chat-opened', this.onOtherChatOpened)
  },

  watch: {
    // only one chat open at a time: opening this one closes the global chat, and opening the
    // global chat closes this one (onOtherChatOpened)
    open (value) {
      if (value) this.$root.$emit('chat-opened', 'game')
    },

    chat() {
      if (!this.chatEnabled) {
        this._chatInited = false
        this.prevLen = 0
        return
      }

      const len = this.messages.length

      // First time chat becomes available: sync baselines, don't beep history
      if (!this._chatInited) {
        this._chatInited = true
        this.prevLen = len
        this.readCount = this.open ? len : len
        this.scrollToBottom()
        return
      }

      const grew = len > (this.prevLen || 0)
      const lastMessage = this.messages.at(-1)

      if (lastMessage?.message === this.sentMessage) {
        // this is the echo of the message we just sent
        this.sentMessage = null
      } else if (grew) {
        // a message arrived from someone else
        this.beep()
      }

      if (this.open) {
        // chat is visible, so everything is read
        this.readCount = len
      }

      this.prevLen = len
      this.scrollToBottom()
    }
  },

  beforeDestroy () {
    this.$root.$off('chat-opened', this.onOtherChatOpened)
    this.leaveMessage()
    window.removeEventListener('resize', this.onWindowResize)
  },

  methods: {
    onLauncherClick () {
      if (this.open) {
        if (!this.bulletClickAllowed()) return // the click just ended a drag
        this.closeChat()
        return
      }
      this.openChat()
    },

    onOtherChatOpened (which) {
      if (which !== 'game' && this.open) this.closeChat()
    },

    openChat() {
      if (!this.bulletClickAllowed()) return // the click just ended a drag
      this.open = true
      // mark everything read
      this.readCount = this.chatEnabled ? this.messages.length : 0
      if (!this.anchored) {
        if (this.position.right == null || this.position.bottom == null) {
          this.resetToDefaultPosition()
        }
        this.clampPosition()
      }
      this.$nextTick(() => this.scrollToBottom())
    },
    closeChat() {
      this.open = false
      this.leaveMessage()
    },
    beep() {
      if (this.beepEnabled && this.$refs.beep) {
        try {
          this.$refs.beep.currentTime = 0
          const p = this.$refs.beep.play()
          if (p && p.catch) p.catch(() => {})
        } catch (e) { /* ignore playback errors */ }
      }
    },
    joinMessage() {
        this.$store.commit('gameChatEdit', true)
    },
    // width of the right-hand <aside> (player panels), so the chat opens to the
    // left of it instead of underneath it.
    asideWidth() {
      const raw = getComputedStyle(document.body).getPropertyValue('--aside-width-plus-gap')
      const n = parseInt(raw, 10)
      return Number.isFinite(n) ? n : 300
    },
    // Default open position: bottom-right of the board, right where the launcher
    // button sits (just left of the aside).
    resetToDefaultPosition() {
      this.position.right = this.asideWidth() + 16
      this.position.bottom = 20
    },
    // Keep the box fully inside the window. Because position is stored as a
    // distance from the right/bottom edges, clamping here is enough to keep it
    // on the bottom on resize and stop it sliding off any edge.
    clampPosition() {
      const margin = 10
      const maxRight = Math.max(margin, window.innerWidth - this.CHAT_WIDTH - margin)
      const maxBottom = Math.max(margin, window.innerHeight - this.CHAT_HEIGHT - margin)
      this.position.right = Math.min(Math.max(this.position.right ?? margin, margin), maxRight)
      this.position.bottom = Math.min(Math.max(this.position.bottom ?? margin, margin), maxBottom)
    },
    getPlayerName(player) {
      const p = this.players && this.players[player]
      return p ? p.name : ''
    },
    getPlayerSlotColor(player) {
      const p = this.players && this.players[player]
      return p ? p.slot : 0
    },
    // Message sender color. Messages written BEFORE the game started (slot page / change-setup
    // chat) carry `slot` directly and their `player` is a slot NUMBER — not an index into the
    // players array — so indexing players with it would crash (e.g. slot 1 in a 1-player game).
    getMessageSlotColor(m) {
      if (!isNil(m.slot)) return m.slot
      return this.getPlayerSlotColor(m.player)
    },
    // Is the message's author still connected? The server nulls a seat's sessionId when its client
    // disconnects, so sessionId is the liveness signal. Mirrors getMessageSlotColor's rule: a
    // pre-game message carries `slot` (a slot NUMBER, matched against players[].slot / slots[].number),
    // otherwise `player` is an index into players. An author we cannot resolve counts as ACTIVE, so
    // we never dim by mistake.
    isMessageAuthorActive(m) {
      if (!m) return true
      if (!isNil(m.slot)) {
        const byPlayer = (this.players || []).find(p => p && p.slot === m.slot)
        if (byPlayer) return !!byPlayer.sessionId
        const slot = (this.slots || []).find(s => s && s.number === m.slot)
        return slot ? !!slot.sessionId : true
      }
      const p = (this.players || [])[m.player]
      return p ? !!p.sessionId : true
    },
    getMessageTime(message) {
      if (!isNil(message.timestamp)) {
        const date = new Date(message.timestamp * 1000)
        return date.toLocaleTimeString(this.locale, {
          hour: '2-digit',
          minute: '2-digit',
        })
      }
      return ''
    },
    keyDown(ev) {
      if (ev.code === 'Space') {
        ev.stopPropagation()
      }
      return
    },
    leaveMessage() {
      this.$store.commit('gameChatEdit', null)
    },
    sendMessage() {
      if (this.localPlayers.length === 1) {
        this.sendMessageByPlayer(this.localPlayers[0])
      }
    },
    sendMessageByPlayer(player) {
      const message = this.newMessage.trim()
      if (message.length>0) {
        // include the slot so the message renders correctly regardless of game phase
        this.$store.dispatch('game/chat', { player: player, slot: this.getPlayerSlotColor(player), message: message } )
        this.sentMessage = message
        this.newMessage = ''
      }
    },
    startDrag(ev) {
      if (this.anchored) return // sits above its launcher
      this.dragging = true

      // current top-left of the box, derived from the right/bottom anchor
      const left = window.innerWidth - this.position.right - this.CHAT_WIDTH
      const top = window.innerHeight - this.position.bottom - this.CHAT_HEIGHT

      // grab point inside the box
      this.offset = {
        x: ev.clientX - left,
        y: ev.clientY - top
      }

      document.addEventListener('mousemove', this.onDrag)
      document.addEventListener('mouseup', this.stopDrag)
    },

    onDrag(ev) {
      if (!this.dragging) return

      const margin = 10
      const windowWidth = window.innerWidth

      // locked to the bottom: only horizontal movement, clamped inside the window
      let left = ev.clientX - this.offset.x
      left = Math.min(Math.max(left, margin), Math.max(margin, windowWidth - this.CHAT_WIDTH - margin))

      // store back as a distance from the right edge; bottom stays fixed
      this.position.right = windowWidth - left - this.CHAT_WIDTH
    },

    stopDrag() {
      this.dragging = false
      document.removeEventListener('mousemove', this.onDrag)
      document.removeEventListener('mouseup', this.stopDrag)

      const posToSave = {
        right: this.position.right,
        bottom: this.position.bottom
      }

      if (!isEqual(posToSave, this.savedPosition)) {
        this.$store.dispatch('settings/update', {
          chatPosition: posToSave,
        })
      }
    },

    onWindowResize() {
      // box is anchored to the bottom-right, so it follows the corner on
      // resize; just re-clamp in case the window became smaller than the box.
      this.clampPosition()
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.gameChatMessages
        const endOfChat = this.$refs.endOfChat
        if (container && endOfChat) {
          container.scrollTop = container.scrollHeight
        }
      })
    }
  }
}
</script>

<style lang="sass" scoped>

::-webkit-scrollbar
  width: 8px
  height: 8px

::-webkit-scrollbar
  width: 8px
  height: 8px

::-webkit-scrollbar-track
  background: #f0f0f0
  border-radius: 10px

::-webkit-scrollbar-thumb
  background: linear-gradient(180deg, #4e9af1, #0056b3)
  border-radius: 10px

  &:hover
    background: linear-gradient(180deg, #66b2ff, #007bff)

.chat-launcher
  position: absolute
  bottom: 20px
  right: calc(var(--aside-width-plus-gap) + 16px)
  z-index: 3
  width: 56px
  height: 56px
  border-radius: 50%
  background: #d32f2f
  border: none
  box-shadow: 0 2px 8px rgba(0,0,0,0.4)
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

  &.active
    box-shadow: 0 0 0 3px rgba(255,255,255,0.85), 0 2px 8px rgba(0,0,0,0.4)

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

// The panel matches the global chat's (GlobalChat.vue .gc-panel): same size, backdrop, corners,
// header, message rows, input and send button — only the colour is the game chat's red.
.game-chat
  width: 360px
  height: 280px
  position: absolute
  z-index: 3
  display: flex
  flex-direction: column
  border-radius: 8px
  background: rgba(0,0,0,0.6)
  box-shadow: 0 2px 10px rgba(0,0,0,0.4)
  cursor: move
  user-select: none /* prevent text selection while dragging */

  // web build: above the launcher (20px + 56px button + 12px gap), right edges aligned
  &.anchored
    right: calc(var(--aside-width-plus-gap) + 16px)
    bottom: 88px
    cursor: default

    @media (max-width: 600px)
      right: 16px !important
      width: calc(100vw - 32px)
      max-width: 360px

  .chat-header
    flex: 0 0 auto
    display: flex
    align-items: center
    justify-content: space-between
    padding: 8px 12px
    border-bottom: 2px solid #d32f2f

    .chat-title
      display: flex
      align-items: center
      font-weight: 500
      text-transform: uppercase
      font-size: 13px

    .chat-bullet
      display: inline-block
      width: 9px
      height: 9px
      border-radius: 50%
      background: #d32f2f
      margin-right: 6px
      flex: 0 0 auto

  .chat-close
    border: none
    background: transparent
    cursor: pointer
    padding: 0
    display: flex
    align-items: center

    .v-icon
      font-size: 16px

  .chat-messages
    flex: 1 1 auto
    overflow-y: auto
    padding: 8px 12px
    cursor: auto
    user-select: text

  .chat-message
    display: flex
    align-items: baseline
    gap: 5px
    margin-bottom: 4px
    font-size: 13px

    // the author: their seat's colour, as a bullet (the global chat's blue bullet + name)
    .chat-author
      display: inline-block
      width: 9px
      height: 9px
      border-radius: 50%
      flex: 0 0 auto
      align-self: center

    .chat-time
      color: #999
      font-size: 11px
      white-space: nowrap

    .chat-text
      word-break: break-word

    // author's seat no longer connected: dim the bullet only, the text stays readable
    &.author-inactive .chat-author
      opacity: 0.35

    &.pending
      opacity: 0.6

  .chat-input
    flex: 0 0 auto
    display: flex
    align-items: center
    gap: 6px
    padding: 4px 12px 8px
    cursor: auto

  .chat-send
    border: none
    border-radius: 5px
    padding: 6px 10px
    cursor: pointer
    flex: 0 0 auto

    &:hover
      filter: brightness(1.15)

</style>
