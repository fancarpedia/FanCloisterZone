<template>
  <div class="game-chat-root" v-if="chatEnabled">
    <!-- Collapsed launcher: red button with chat icon + unread badge -->
    <button
      v-show="!open"
      class="chat-launcher"
      :title="$t('chat.open') || 'Chat'"
      @click="openChat"
    >
      <v-icon class="chat-launcher-icon color-overlay">fas fa-comments</v-icon>
      <span v-if="unread > 0" class="chat-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <!-- Expanded chat (movable) -->
    <div
      v-show="open"
      class="game-chat"
      :style="positionStyle"
      @mousedown="startDrag"
    >
      <button
        class="chat-close"
        :title="$t('chat.close') || 'Close'"
        @mousedown.stop
        @click="closeChat"
      >
        <v-icon class="color-overlay">fas fa-times</v-icon>
      </button>
      <div class="messages-wrapper">
        <div class="messages" ref="gameChatMessages">
          <div class="message"
            v-for="m in messages"
          >
            <div
              :class="'sender color-bg-important color color-overlay color-'+ getPlayerSlotColor(m.player)"
            >
              <!-- {{ getPlayerName(m.player) }} -->
            </div>
            <div class="time">
              {{ getMessageTime(m) }}
            </div>
            <div class="message-text">
	        {{ m.message }}
	      </div>
          </div>
          <div class="message">
            {{ sentMessage }}
          </div>
          <div ref="endOfChat" ></div>
        </div>
        <div class="send-message-wrapper">
          <div class="new-message-text-wrapper">
            <v-text-field
              class="edit-message"
              ref="chatMessage"
              v-model="newMessage"
              :label="$t('chat.new-message')"
              :style="{ width: inputWidth + 'px' }"
              @focus="joinMessage"
              @blur="leaveMessage"
              @keydown="keyDown"
              @keydown.enter="sendMessage"
            />
          </div>
          <div class="new-massage-send-wrapper">
            <button
              v-for="p in localPlayers"
              :class="'send-button color-bg-important color color-overlay color-'+ getPlayerSlotColor(p)"
              @mousedown.stop
              @click="sendMessageByPlayer(p)"
            >
             <v-icon class="color-overlay">fas fa-paper-plane</v-icon>
            </button>
          </div>
        </div>
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

export default {
  data () {
    const src = require('~/assets/beep.wav')
    return {
      dragging: false,
      open: false,
      readCount: 0,
      newMessage: '',
      CHAT_WIDTH: 400,
      CHAT_HEIGHT: 200,
      offset: {
        x: 0,
        y: 0
      },
      position: {
        right: null,
        bottom: null
      },
      sentMessage: null,
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

      if (this.position.right != null) style.right = this.position.right + 'px'
      if (this.position.bottom != null) style.bottom = this.position.bottom + 'px'

      return style
    },

    inputWidth() {
      const chatWidth = 400 // or dynamically: this.$el.offsetWidth
      const buttonWidth = 40 // approximate width of each send button including margin
      const totalButtonsWidth = this.localPlayers.length * buttonWidth + 10 // add small padding/margin
      const width = chatWidth - totalButtonsWidth
      return width > 50 ? width : 50 // minimum width 50px
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
  },

  watch: {
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
    this.leaveMessage()
    window.removeEventListener('resize', this.onWindowResize)
  },

  methods: {
    openChat() {
      this.open = true
      // mark everything read
      this.readCount = this.chatEnabled ? this.messages.length : 0
      if (this.position.right == null || this.position.bottom == null) {
        this.resetToDefaultPosition()
      }
      this.clampPosition()
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
      return this.players[player].name
    },
    getPlayerSlotColor(player) {
      return this.players[player].slot
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
        this.$store.dispatch('game/chat', { player: player, message: message } )
        this.sentMessage = message
        this.newMessage = ''
      }
    },
    startDrag(ev) {
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
          container.scrollTop = endOfChat.offsetTop
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

.game-chat
  width: 400px
  height: 200px
  background-color: rgba(0,0,0,0.5)
  padding: 0
  position: absolute
  cursor: move
  user-select: none /* prevent text selection while dragging */
  display: flex
  align-items: center
  justify-content: center
  font-weight: bold
  z-index: 3

  .chat-close
    position: absolute
    top: 4px
    right: 14px
    z-index: 4
    width: 26px
    height: 26px
    border-radius: 50%
    border: none
    background: rgba(211,47,47,0.85)
    color: white
    cursor: pointer
    display: flex
    align-items: center
    justify-content: center
    padding: 0

    &:hover
      background: #e53935

    .v-icon
      color: white
      font-size: 14px

  .messages-wrapper
    overflow: hidden
    height: 160px

  .messages
    position: absolute
    overflow-y: scroll
    overflow-x: hidden
    margin-bottom: 10px
    width: 100%
    bottom: 50px
    left: 0
    padding: 5px
    height: 140px

  .edit-message
    width: 200px
    height: 40px
    margin: 5px

  .send-message-wrapper
    display: flex
    width: 400px
    position: absolute
    bottom: 0
    left: 0

  .new-message-text-wrapper
    flex: 1 1 auto
    min-width: 0

  .new-massage-send-wrapper
    flex: 0 0 auto
    padding-top: 12px

  .send-button
    padding: 5px
    border-radius: 5px
    margin-left: 10px

  .message
    display: flex
    gap: 5px
    margin-bottom: 0.5ex

    .sender
      padding: 2px 5px
      display: inline-block
      border-radius: 5px

    .time
      color: #bbb
      white-space: nowrap

  .theme--dark .message .message-text
    color: white

  .theme--light .message .message-text
    color: black

</style>
