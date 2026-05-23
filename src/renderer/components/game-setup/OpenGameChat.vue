<template>
  <div
    v-if="isAvailable"
    class="open-game-chat"
    :style="positionStyle"
    @mousedown="startDrag"
  >
    <div class="messages-wrapper">
      <div class="messages" ref="messagesContainer">
        <div
          v-for="(m, idx) in messages"
          :key="idx"
          class="message"
        >
          <div
            :class="'sender color-bg-important color color-overlay color-' + m.player"
          />
          <div class="time">{{ getMessageTime(m) }}</div>
          <div class="message-text">
            <span class="sender-name">{{ getSenderName(m.player) }}</span>
            {{ m.message }}
          </div>
        </div>
        <div ref="endOfChat" />
      </div>

      <div class="send-message-wrapper">
        <div class="new-message-text-wrapper">
          <v-text-field
            class="edit-message"
            ref="chatInput"
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
            v-for="slot in localSlots"
            :key="slot.number"
            :class="'send-button color-bg-important color color-overlay color-' + slot.number"
            :title="slot.name"
            @click="sendMessageBySlot(slot)"
          >
            <v-icon class="color-overlay">fas fa-paper-plane</v-icon>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import isArray from 'lodash/isArray'
import isEqual from 'lodash/isEqual'
import isNil from 'lodash/isNil'
import { mapState } from 'vuex'

export default {
  data () {
    return {
      newMessage: '',
      dragging: false,
      offset: { x: 0, y: 0 },
      position: { top: 100, left: 100, right: null, bottom: null }
    }
  },

  computed: {
    ...mapState({
      gameChat: state => state.game.gameChat,
      slots: state => state.game.slots,
      sessionId: state => state.networking.sessionId,
      locale: state => state.settings.locale,
      savedPosition: state => state.settings.openGameChatPosition
    }),

    isAvailable () {
      return isArray(this.gameChat)
    },

    messages () {
      return this.gameChat || []
    },

    localSlots () {
      if (!this.slots || !this.sessionId) return []
      return this.slots.filter(s => s.sessionId === this.sessionId)
    },

    positionStyle () {
      const style = {}
      if (this.position.top != null) style.top = this.position.top + 'px'
      if (this.position.bottom != null) style.bottom = this.position.bottom + 'px'
      if (this.position.left != null) style.left = this.position.left + 'px'
      if (this.position.right != null) style.right = this.position.right + 'px'
      return style
    },

    inputWidth () {
      const chatWidth = 400
      const buttonWidth = 40
      const totalButtonsWidth = this.localSlots.length * buttonWidth + 10
      const width = chatWidth - totalButtonsWidth
      return width > 50 ? width : 50
    }
  },

  mounted () {
    if (this.savedPosition) {
      this.position.top = this.savedPosition.top
      this.position.left = this.savedPosition.left
      this.position.right = this.savedPosition.right
      this.position.bottom = this.savedPosition.bottom
    }
    this.$nextTick(() => this.scrollToBottom())
    window.addEventListener('resize', this.onWindowResize)
  },

  beforeDestroy () {
    this.leaveMessage()
    window.removeEventListener('resize', this.onWindowResize)
  },

  watch: {
    messages () {
      this.scrollToBottom()
    }
  },

  methods: {
    getSenderName (slotNumber) {
      if (!this.slots) return ''
      const slot = this.slots.find(s => s.number === slotNumber)
      return slot ? slot.name : ''
    },

    getMessageTime (message) {
      if (!isNil(message.timestamp)) {
        const date = new Date(message.timestamp * 1000)
        return date.toLocaleTimeString(this.locale, {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      return ''
    },

    joinMessage () {
      this.$store.commit('gameChatEdit', true)
    },

    leaveMessage () {
      this.$store.commit('gameChatEdit', null)
    },

    keyDown (ev) {
      if (ev.code === 'Space') ev.stopPropagation()
    },

    sendMessage () {
      if (this.localSlots.length === 1) {
        this.sendMessageBySlot(this.localSlots[0])
      }
    },

    sendMessageBySlot (slot) {
      const message = this.newMessage.trim()
      if (message.length > 0) {
        this.$store.dispatch('game/chat', { player: slot.number, message })
        this.newMessage = ''
      }
    },

    scrollToBottom () {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        const end = this.$refs.endOfChat
        if (container && end) {
          container.scrollTop = end.offsetTop
        }
      })
    },

    startDrag (ev) {
      this.dragging = true
      const chatWidth = this.$el.offsetWidth
      const chatHeight = this.$el.offsetHeight
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      this.offset = {
        x: this.position.left != null
          ? ev.clientX - this.position.left
          : ev.clientX - (windowWidth - chatWidth),
        y: this.position.top != null
          ? ev.clientY - this.position.top
          : ev.clientY - (windowHeight - chatHeight)
      }
      document.addEventListener('mousemove', this.onDrag)
      document.addEventListener('mouseup', this.stopDrag)
    },

    onDrag (ev) {
      if (!this.dragging) return
      const chatWidth = this.$el.offsetWidth
      const chatHeight = this.$el.offsetHeight
      const margin = 10
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      let newLeft = ev.clientX - this.offset.x
      let newTop = ev.clientY - this.offset.y

      if (this.position.right === 0) {
        if (newLeft < windowWidth - chatWidth - margin) {
          this.position.right = null
          this.position.left = newLeft
        }
      } else {
        newLeft = Math.min(Math.max(newLeft, margin), windowWidth - chatWidth - margin)
        if (newLeft >= windowWidth - chatWidth - margin - 1) {
          this.position.left = null
          this.position.right = margin
        } else {
          this.position.left = newLeft
          this.position.right = null
        }
      }

      if (this.position.bottom === 0) {
        if (newTop < windowHeight - chatHeight - margin) {
          this.position.bottom = null
          this.position.top = newTop
        }
      } else {
        newTop = Math.min(Math.max(newTop, margin), windowHeight - chatHeight - margin)
        if (newTop >= windowHeight - chatHeight - margin - 1) {
          this.position.top = null
          this.position.bottom = margin
        } else {
          this.position.top = newTop
          this.position.bottom = null
        }
      }
    },

    stopDrag () {
      this.dragging = false
      document.removeEventListener('mousemove', this.onDrag)
      document.removeEventListener('mouseup', this.stopDrag)
      const posToSave = {
        top: this.position.top,
        left: this.position.left,
        right: this.position.right,
        bottom: this.position.bottom
      }
      if (!isEqual(posToSave, this.savedPosition)) {
        this.$store.dispatch('settings/update', { openGameChatPosition: posToSave })
      }
    },

    onWindowResize () {
      const chatWidth = this.$el.offsetWidth
      const chatHeight = this.$el.offsetHeight
      const margin = 10
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      if (this.position.right === margin) {
        if (chatWidth + margin > windowWidth) {
          this.position.right = null
          this.position.left = Math.max(margin, windowWidth - chatWidth - margin)
        }
      } else if (this.position.left != null) {
        if (this.position.left + chatWidth + margin > windowWidth) {
          this.position.left = Math.max(margin, windowWidth - chatWidth - margin)
        }
      }

      if (this.position.bottom === margin) {
        if (chatHeight + margin > windowHeight) {
          this.position.bottom = null
          this.position.top = Math.max(margin, windowHeight - chatHeight - margin)
        }
      } else if (this.position.top != null) {
        if (this.position.top + chatHeight + margin > windowHeight) {
          this.position.top = Math.max(margin, windowHeight - chatHeight - margin)
        }
      }
    }
  }
}
</script>

<style lang="sass" scoped>
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

.open-game-chat
  width: 400px
  height: 200px
  background-color: rgba(0, 0, 0, 0.5)
  padding: 0
  position: absolute
  cursor: move
  user-select: none
  display: flex
  align-items: center
  justify-content: center
  font-weight: bold

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
      flex-shrink: 0
      width: 10px
      height: 10px
      border-radius: 50%
      align-self: center

    .time
      color: #bbb
      white-space: nowrap
      font-size: 11px

    .message-text
      word-break: break-word

      .sender-name
        font-weight: 600
        margin-right: 3px

  .theme--dark .message .message-text
    color: white

  .theme--light .message .message-text
    color: black
</style>