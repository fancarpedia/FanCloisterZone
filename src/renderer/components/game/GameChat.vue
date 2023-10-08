<template>
  <div class="game-chat">
   <div class="messages-wrapper">
    <div class="messages" ref="gameChatMessages">
        <div class="message"
          v-for="m in messages"
        >
          {{ m.player }} {{ m.message }}
        </div>
        <div class="message">
          {{ sentMessage }}
        </div>
        <div ref="endOfChat" ></div>
    </div>
    <v-text-field class="edit-message" ref="chatMessage" v-model="newMessage" :label="$t('game.chat.newMessage')" @focus="joinMessage" @blur="leaveMessage" @keydown.enter="sendMessage" />
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
      currentPlayer: state => {
      	for(let i=0;i<state.game.slots.length;i++) {
	        if (state.game.slots[i]?.sessionId == state.networking.sessionId) {
    	      return state.game.slots[i].number
        	}
        }
        return null
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
          console.log(lastMessage)
	      if (lastMessage[0].message.player.message == this.sentMessage) {
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
    leaveMessage() {
        this.$store.commit('gameChatEdit', null)
    },
    sendMessage() {
      console.log(this.chat);
      this.$store.dispatch('game/chat', { player: this.currentPlayer, message: this.newMessage } )
      this.sentMessage = this.newMessage;
      this.newMessage = '';
    }
  }
}
</script>

<style lang="sass" scoped>

.game-chat
  position: absolute
  bottom: 50px
  left: 50px
  width: 20%
  height: 20%
  background-color: rgba(0,0,0,0.5)
  padding: 10px
  
  .messages-wrapper
    overflow: hidden
    width: 200px
    height: 200px
    position: relative
    
  .messages
    position: absolute
    overflow-y: hidden
    overflow-x: hidden
    margin-bottom: 10px	
    width: 100%
    bottom: 50px
    left: 0
    
  .edit-message
    height: 20%
    width: 100%
    margin: 0
    padding: 0
    position: absolute
    bottom: 0
    left: 0
    background-color: rgba(0,0,0,0.5)
  
</style>
