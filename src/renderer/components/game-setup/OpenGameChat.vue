<template>
  <div
    v-if="isAvailable"
    class="open-game-chat"
  >
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
        <span v-if="localSlots.length === 0" class="no-slot-hint">{{ $t('chat.take-slot-hint') }}</span>
        <v-text-field
          v-else
          class="edit-message"
          ref="chatInput"
          v-model="newMessage"
          :label="$t('chat.new-message')"
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
</template>

<script>
import isArray from 'lodash/isArray'
import isNil from 'lodash/isNil'
import { mapState } from 'vuex'

export default {
  data () {
    return {
      newMessage: ''
    }
  },

  computed: {
    ...mapState({
      gameChat: state => state.game.gameChat,
      slots: state => state.game.slots,
      sessionId: state => state.networking.sessionId,
      locale: state => state.settings.locale
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
    }
  },

  mounted () {
    this.$nextTick(() => this.scrollToBottom())
  },

  beforeDestroy () {
    this.leaveMessage()
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
  display: flex
  flex-direction: column
  width: 100%
  height: 100%
  overflow: hidden
  font-weight: bold

  .messages
    flex: 1 1 0
    overflow-y: scroll
    overflow-x: hidden
    padding: 5px
    min-height: 0

  .send-message-wrapper
    display: flex
    width: 100%

  .new-message-text-wrapper
    flex: 1 1 auto
    min-width: 0

  .new-massage-send-wrapper
    flex: 0 0 auto
    padding-top: 12px

  .no-slot-hint
    font-size: 11px
    color: #aaa
    font-style: italic
    font-weight: normal
    white-space: nowrap
    display: flex
    align-items: center
    height: 40px
    padding: 0 8px

  .edit-message
    width: 100%
    height: 40px
    margin: 5px 5px 5px 0

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