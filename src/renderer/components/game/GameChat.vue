<template>
  <div class="game-chat">
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
      
    }
  },
  
  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass'
    }),

    ...mapState({
      chat: state => state.game.gameChat,
      slots: state => state.game.slots,
      players: state => state.game.players,
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
      }
    }),

    messages() {
      return this.chat
    },
    
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
      }
    }
  }
}
</script>

<style lang="sass" scoped>

.game-chat
  position: absolute
  bottom: 0
  right: var(--aside-width-plus-gap)
  width: var(--aside-width)
  height: calc(100% - var(--action-bar-height))
  background-color: rgba(0,0,0,0.5)
  padding: 0
  
  .messages-wrapper
    overflow: hidden
    width: var(--aside-width)
    height: calc(100% - 40px)
    position: relative
    
  .messages
    position: absolute
    overflow-y: hidden
    overflow-x: hidden
    margin-bottom: 10px	
    width: 100%
    bottom: 50px
    left: 0
    padding: 5px

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
