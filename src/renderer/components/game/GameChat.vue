<template>
  <div
    class="game-chat"
    :style="{ top: position.top + 'px', left: position.left + 'px', display: getChatDisplay() }"
    @mousedown="startDrag"
  >
    <div class="messages-wrapper">
      <div class="messages" ref="gameChatMessages">
        <div class="message"
          v-for="m in messages"
        >
          <div
            :class="'sender color-bg-important color color-'+ getPlayerSlotColor(m.player)"
          >
            {{ getPlayerName(m.player) }}
          </div>
          <div class="message-text">
	        {{ m.message }}
	      </div>
        </div>
        <div class="message" style="display: none">
          {{ sentMessage }}
        </div>
        <div ref="endOfChat" ></div>
      </div>
      <v-text-field
        class="edit-message"
        ref="chatMessage"
        v-model="newMessage"
        :label="$t('game.chat.new-message')"
        @focus="joinMessage"
        @blur="leaveMessage"
        @keydown="keyDown"
        @keydown.enter="sendMessage"
      />
    </div>
  </div>
</template>

<script>
import { ref } from "vue"
import { mapGetters, mapState } from 'vuex'

export default {
  data () {
    return {
      sentMessage: null,
      newMessage: '',
      position: {
        top: 100,
        left: 100,
      },
      dragging: false,
      offset: {
        x: 0,
        y: 0
      }
    }
  },
  
  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    ...mapState({
      chat: state => state.game.gameChat,
      messagePlayer: state => {
        let firstLocalPlayer
      	for(let i=0;i<state.game.players.length;i++) {
      	    console.log('Current action player',state.game.action.player,'i',i,state.networking.sessionId,state.game.players)
	        if (state.game.players[i]?.sessionId == state.networking.sessionId) {
	          if (state.game.action.player == i) {
	            return i
	          }
	          if (firstLocalPlayer === null) {
	            firstLocalPlayer = i
	          }
        	}
        }
        return firstLocalPlayer
      },
      players: state => state.game.players,
      slots: state => state.game.slots,
      savedPosition(state) {
        return state.settings.chatPosition
      }
    }),

    messages() {
      return this.chat
    },
    
  },

  mounted() {
    if (this.savedPosition) {
      this.position.top = this.savedPosition.top;
      this.position.left = this.savedPosition.left;
    }
  },
  
  watch: {
    chat() {
      const lastMessage = this.chat.slice(-1);
      if (lastMessage) {
	      if (lastMessage[0].player.message == this.sentMessage) {
	        this.sentMessage = null;
	      }
	  }
    }
  },

  beforeDestroy () {
    this.leaveMessage();
  },

  methods: {
    joinMessage() {
        this.$store.commit('gameChatEdit', true)
    },
    getPlayerName(player) {
      return this.players[player].name
    },
    getPlayerSlotColor(player) {
      return this.players[player].slot
    },
    getChatDisplay() {
      return (this.chat ? 'block' : 'none')
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
      if (this.newMessage.trim().length>0) {
        this.$store.dispatch('game/chat', { player: this.messagePlayer, message: this.newMessage.trim() } )
        this.sentMessage = this.newMessage.trim()
        this.newMessage = ''
        this.scrollToBottom()
      }
    },
    startDrag(ev) {
      this.dragging = true;
      this.offset.x = ev.clientX - this.position.left
      this.offset.y = ev.clientY - this.position.top
      document.addEventListener('mousemove', this.onDrag)
      document.addEventListener('mouseup', this.stopDrag)
    },
    onDrag(ev) {
      if (this.dragging) {
        this.position.left = ev.clientX - this.offset.x
        this.position.top = ev.clientY - this.offset.y
      }
    },
    scrollToBottom() {
      const container = this.$refs.gameChatMessages;
      container.scrollTop = container.scrollHeight;
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.onDrag)
      document.removeEventListener('mouseup', this.stopDrag)
      this.$store.dispatch('settings/update', {
        chatPosition: { ...this.position },
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
  background: #888
  border-radius: 2px

::-webkit-scrollbar-thumb
  background: #f0f0f0
  border-radius: 2px
  margin: 2px

::-webkit-scrollbar-thumb:hover
  background: #555

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
    height: 40px
    margin: 5px
    position: absolute
    bottom: 0
    left: 0

  .message
    display: flex
    gap: 5px
    margin-bottom: 0.5ex

    .sender
      padding: 2px 5px
      color: white
      display: inline-block
      border-radius: 5px
    
  .theme--dark .message .message-text
    color: white
      
  .theme--light .message .message-text
    color: black
      
</style>
