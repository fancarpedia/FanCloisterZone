<template>
  <div
    class="game-chat"
    :style="positionStyle"
    @mousedown="startDrag"
  >
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
            :label="$t('game.chat.new-message')"
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
            @click="sendMessageByPlayer(p)"
          >
           <v-icon class="color-overlay">fas fa-paper-plane</v-icon>
          </button>
        </div>
      </div>
    </div>
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
    return {
      dragging: false,
      newMessage: '',
      offset: {
        x: 0,
        y: 0
      },
      position: {
        top: 100,
        left: 100,
      },
      sentMessage: null,
      displayChat: 'none'
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
      sessionId: state => state.networking.sessionId
    }),

    messages() {
      return this.chat
    },

    localPlayers() {
      return this.players
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => player.sessionId === this.sessionId)
        .map(({ index }) => index)
    },
    
    positionStyle() {
      const style = { display: this.displayChat }

      if (this.position.top != null) style.top = this.position.top + 'px'
      if (this.position.bottom != null) style.bottom = this.position.bottom + 'px'
      if (this.position.left != null) style.left = this.position.left + 'px'
      if (this.position.right != null) style.right = this.position.right + 'px'

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
    if (this.savedPosition) {
      this.position.top = this.savedPosition.top
      this.position.left = this.savedPosition.left
      this.position.right = this.savedPosition.right
      this.position.bottom = this.savedPosition.bottom
    }

    this.displayChat = isArray(this.$store.state.game.gameChat) ? 'block' : 'none'
    this.$nextTick(() => this.scrollToBottom())

    window.addEventListener('resize', this.onWindowResize)
  },
  
  watch: {
    chat() {
      const lastMessage = this.messages.at(-1)
      if (lastMessage?.message === this.sentMessage) {
        this.sentMessage = null
      }
      this.scrollToBottom()
    }
  },

  beforeDestroy () {
    this.leaveMessage()
    window.removeEventListener('resize', this.onWindowResize)
  },

  methods: {
    joinMessage() {
        this.$store.commit('gameChatEdit', true)
    },
    ensureChatIsVisible() {
      const chatWidth = 400  // or get it dynamically if resizable
      const chatHeight = 200
      const margin = 10 // optional margin from edge

      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      this.position.left = Math.min(Math.max(this.position.left, margin), windowWidth - chatWidth - margin)
      this.position.top = Math.min(Math.max(this.position.top, margin), windowHeight - chatHeight - margin)
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

      const chatWidth = this.$el.offsetWidth
      const chatHeight = this.$el.offsetHeight
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      // If snapped to right/bottom, offset is relative to those
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
    
    startDrag2(ev) {
      this.dragging = true
      this.offset = {
        x: ev.clientX - this.position.left,
        y: ev.clientY - this.position.top,
      }
      document.addEventListener('mousemove', this.onDrag)
      document.addEventListener('mouseup', this.stopDrag)
    },

    onDrag(ev) {
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
    stopDrag() {
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
        this.$store.dispatch('settings/update', {
          chatPosition: posToSave,
        })
      }
      if (!isEqual(posToSave, this.savedPosition)) {
        this.$store.dispatch('settings/update', {
          chatPosition: posToSave,
        })
      }
    },

    onWindowResize() {
      const chatWidth = this.$el.offsetWidth
      const chatHeight = this.$el.offsetHeight
      const margin = 10
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      // Horizontal
      if (this.position.right === margin) {
        // keep snapped to right if still fits
        if (chatWidth + margin > windowWidth) {
          this.position.right = null
          this.position.left = Math.max(margin, windowWidth - chatWidth - margin)
        }
      } else if (this.position.left != null) {
        if (this.position.left + chatWidth + margin > windowWidth) {
          this.position.left = Math.max(margin, windowWidth - chatWidth - margin)
        }
      }

      // Vertical
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
