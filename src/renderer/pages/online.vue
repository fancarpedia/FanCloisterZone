<template>
  <div class="online-page">
    <OnlineStatus />
    <header>
      <v-btn :disabled="!connected" large color="primary" @click="createGame()">
        {{ $t('button.create-game') }}
      </v-btn>

      <v-btn :disabled="!connected" large color="primary" @click="openJoinGameDialog()">
        {{ $t('button.join-game') }}
      </v-btn>

      <v-btn large color="secondary" @click="disconnect()">
        {{ $t('button.disconnect') }}
      </v-btn>
    </header>
    <main>
      <div class="lobby">
        <h2>{{ $t('index.online.lobby') }}</h2>

        <div v-if="!verifiedGamePublicList.length" class="empty-message">
          <p>
            <i>{{ $t('index.online.no-public-games') }}</i>
          </p>
        </div>

        <div class="game-list public">
          <div
            v-for="{ game, slots, valid, isOwner, isStarted } in verifiedGamePublicList"
            :key="game.gameId"
            class="game"
          >
            <div v-if="game.name" class="game-name">
              {{ game.name }}
            </div>

            <div class="game-header">
              <span class="game-key">{{ game.key.substring(0,3) }}-{{ game.key.substring(3) }}</span>
              <span class="game-started">
                <span v-if="isStarted">
                  {{ formatDate(game.started) }}
                </span>
                <span v-if="!isStarted">
                  {{ $t('index.online.not-yet-started') }}
                </span>
              </span>
            </div>

            <div
              class="game-slots"
              :class="{ full: slots.length > 8 }"
            >
              <div
                v-for="s in slots"
                :key="s.number"
                :class="'game-slot color color-' + s.number + ' ' + ((s.clientId == clientId) ? 'local' : '') + ' ' + ((s.sessionId || s.clientId == clientId) ? '' : 'disconnected')"
                :title="s.name"
              >
                <div class="meeple">
                  <Meeple type="SmallFollower" />
                </div>
                <div class="name">
                  {{ s.name }}
                </div>
              </div>
            </div>

            <div :class="{ invalid: !valid }">
              <GameSetupOverviewInline :sets="game.setup.sets" :elements="game.setup.elements" />
            </div>

            <div class="buttons">
              <v-btn color="primary" :disabled="!valid || !connected" @click="resume(game)"><v-icon left>fa-play</v-icon> {{ $t('button.join-game') }}</v-btn>
              <v-btn color="secondary" :disabled="!isOwner || !connected" @click="del(game)"><v-icon>fa-trash-alt</v-icon></v-btn>
            </div>
          </div>
        </div>
      </div>

      <div class="games-in-progress">
        <h2>{{ $t('index.online.games-in-progress') }}</h2>

        <div v-if="!verifiedGameList.length" class="empty-message">
          <p>
            <i>{{ $t('index.online.you-have-no-game-in-progress') }}</i>
          </p>
          <p>
            <i>
              {{ $t('index.online.online-storage-description') }}
            </i>
          </p>
        </div>

        <div class="game-list player">
          <div
            v-for="{ game, slots, valid, isOwner, isStarted } in verifiedGameList"
            :key="game.gameId"
            class="game"
          >
            <div v-if="game.name" class="game-name">
              {{ game.name }}
            </div>

            <div class="game-header">
              <span class="game-key">{{ game.key.substring(0,3) }}-{{ game.key.substring(3) }}</span>
              <span class="game-started">
                <span v-if="isStarted">
                  {{ formatDate(game.started) }}
                </span>
                <span v-if="!isStarted">
                  {{ $t('index.online.not-yet-started') }}
                </span>
              </span>
            </div>

            <div
              class="game-slots"
              :class="{ full: slots.length > 8 }"
            >
              <div
                v-for="s in slots"
                :key="s.number"
                :class="'game-slot color color-' + s.number + ' ' + ((s.clientId == clientId) ? 'local' : '') + ' ' + ((s.sessionId || s.clientId == clientId) ? '' : 'disconnected')"
                :title="s.name"
              >
                <div class="meeple">
                  <Meeple type="SmallFollower" />
                </div>
                <div class="name">
                  {{ s.name }}
                </div>
              </div>
            </div>

            <div :class="{ invalid: !valid }">
              <GameSetupOverviewInline :sets="game.setup.sets" :elements="game.setup.elements" />
            </div>

            <div class="buttons">
              <v-btn color="primary" :disabled="!valid || !connected" @click="resume(game)"><v-icon left>fa-play</v-icon> {{ $t('button.resume') }}</v-btn>
              <v-btn color="secondary" :disabled="!isOwner || !connected" @click="del(game)"><v-icon>fa-trash-alt</v-icon></v-btn>
            </div>
          </div>
        </div>
      </div>
    </main>

    <v-dialog
      v-model="showDeleteDialog"
      persistent
      max-width="400px"
    >
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('index.online.abandon-game') }}</span>
        </v-card-title>
        <v-card-text>
          {{ $t('index.online.remove-unfinished-game-confirmation') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showDeleteDialog = false"
          >
            {{ $t('button.cancel') }}
          </v-btn>
          <v-btn
            text
            @click="delConfirm()"
          >
            {{ $t('button.remove') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="showJoinDialog"
      persistent
      max-width="400px"
    >
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('index.online.join-game') }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <p>{{ $t('index.online.paste-a-game-key') }}</p>
            <v-text-field ref="joinInput" v-model="joinGameId" :label="$t('index.online.game-id')" @keydown.enter="joinGame"  />
            <v-alert
              v-if="joinError"
              type="error"
              dense
            >
              {{ joinError }}
            </v-alert>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showJoinDialog = false">{{ $t('button.cancel') }}</v-btn>
          <v-btn text @click="joinGame">{{ $t('button.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="showAlertMessage"
      max-width="400px"
    >
      <v-card>
        <v-card-title>
          <span class="headline"></span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <p>{{ getAlertMessageText }}</p>
            <div
                v-for="link in getAlertMessageLinks"
              >
                <div><a :href="link.url" target="_blank">{{ link.title }}</a></div>
            </div>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="hideAlertMessage = true">{{ $t('button.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script>
import { mapState } from 'vuex'
import sortBy from 'lodash/sortBy'

import GameSetupOverviewInline from '@/components/game-setup/overview/GameSetupOverviewInline'
import OnlineStatus from '@/components/OnlineStatus'
import Meeple from '@/components/game/Meeple'

import { STATUS_CONNECTED } from '@/store/networking'

export default {
  components: {
    GameSetupOverviewInline,
    OnlineStatus,
    Meeple
  },

  data () {
    return {
      hideAlertMessage: false,
      showDeleteDialog: false,
      showDeleteGameId: null,
      showJoinDialog: false,
      joinGameId: '',
      joinError: null
    }
  },

  computed: {
    ...mapState({
      alertMessage: state => state.online.alertMessage,
      clientId: state => state.settings.clientId,
      gameList: state => state.online.gameList,
      gamePublicList: state => state.online.gamePublicList,
      playOnlineHostname: state => state.settings.playOnlineUrl.split('/')[0],
      locale: state => state.settings.locale,
      connected: state => state.networking.connectionStatus === STATUS_CONNECTED
    }),

    getAlertMessageLinks() {
      return this.alertMessage && this.alertMessage.message.links ? this.alertMessage.message.links : [];
    },
    getAlertMessageText() {
      return this.alertMessage && this.alertMessage.message.message ? this.alertMessage.message.message : '';
    },
    showAlertMessage: {
      get() {
        return this.alertMessage && this.alertMessage.message && !this.hideAlertMessage;
      },
      set(value) {
        // When dialog is dismissed (value goes false), set hideAlertMessage=true
        if (!value) {
          this.hideAlertMessage = true;
        }
      }
    },

    verifiedGameList () {
      return this.gameList.map(game => {
        const edition = game.setup.elements.garden ? 2 : 1
        const valid = !this.$tiles.getExpansions(game.setup.sets, edition)._UNKNOWN
        const slots = sortBy(game.slots.filter(s => s.clientId), 'order')
        const isOwner = game.owner === this.$store.state.settings.clientId
        const isStarted = !(game.started == null || game.started === '')
        return { game, valid, slots, isOwner, isStarted }
      })
    },

    verifiedGamePublicList () {
      return this.gamePublicList.map(game => {
        const edition = game.setup.elements.garden ? 2 : 1
        const valid = !this.$tiles.getExpansions(game.setup.sets, edition)._UNKNOWN
        const slots = sortBy(game.slots.filter(s => s.clientId), 'order')
        const isOwner = game.owner === this.$store.state.settings.clientId
        const isStarted = !(game.started == null || game.started === '')
        return { game, valid, slots, isOwner, isStarted }
      })
    }
  },

  beforeCreate () {
    // useful for dev mode, reload on this page redirects back to home
    if (!this.$store.state.networking.connectionType) {
      this.$router.push('/')
    }
  },

  mounted () {
  console.log("Initial alertMessage:", this.alertMessage);
  console.log("Initial showAlertMessage:", this.showAlertMessage);
    if (this.$store.state.networking.connectionStatus === STATUS_CONNECTED) {
      // not reconnecting
      this.$connection.send({ type: 'LIST_GAMES', payload: {} })
      this.$connection.send({ type: 'LIST_PUBLIC_GAMES', payload: {} })
    }
  },

  beforeDestroy () {
    this._onClose && this.$connection.off('close', this._onClose)
  },

  watch: {
    alertMessage: {
      handler(newVal) {
        // When a new message arrives, show dialog
        if (newVal && newVal.message) {
          this.hideAlertMessage = false;
        }
      },
      deep: true
    }
  },

  methods: {
    createGame () {
      this.$store.dispatch('gameSetup/newGame')
      this.$router.push('/game-setup')
    },

    formatDate(date) {
      return new Date(date).toLocaleString(this.locale);
    },
    
    openJoinGameDialog () {
      this.joinGameId = ''
      this.showJoinDialog = true
      setTimeout(() => {
        this.$refs.joinInput.focus()
      }, 1)
    },

    joinGame () {
      this.joinError = null
      this.$connection.onNextSendError(err => {
        this.joinError = err.message
      })
      this.$connection.send({ type: 'JOIN_GAME', payload: { gameKey: this.joinGameId } })
    },

    disconnect () {
      this.$store.dispatch('networking/close')
      this.$router.push('/')
    },

    resume (game) {
      this.$connection.send({ type: 'JOIN_GAME', payload: { gameId: game.gameId } })
    },

    del (game) {
      this.showDeleteDialog = true
      this.showDeleteGameId = game.gameId
    },

    async delConfirm () {
      this.showDeleteDialog = false
      await this.$connection.send({ type: 'ABANDON_GAME', payload: { gameId: this.showDeleteGameId } })
      await this.$connection.send({ type: 'LIST_GAMES', payload: {} })
      await this.$connection.send({ type: 'LIST_PUBLIC_GAMES', payload: {} })
    }
  }
}
</script>

<style lang="sass" scoped>
.online-page
  min-height: 100vh

  +theme using ($theme)
    background: map-get($theme, 'board-bg')

header
  padding: 8px 0 16px
  display: flex
  align-items: center
  justify-content: center

  +theme using ($theme)
    background-color: map-get($theme, 'cards-bg')
    color: map-get($theme, 'gray-text-color')

  .v-btn
    margin: 0 15px

h2
  font-weight: 300
  font-size: 16px
  text-transform: uppercase
  text-align: center
  margin-top: 30px

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.game-list
  padding: 0 20px
  display: flex
  flex-wrap: wrap

  &.player
    +theme using ($theme)
      background-color: map-get($theme, 'cards-bg')
      color: map-get($theme, 'gray-text-color')
  

.game
  width: 380px
  padding: 20px 10px
  margin: 10px
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.15), 0 3px 10px 0 rgba(0, 0, 0, 0.10)

  .invalid
    opacity: 0.4

  .buttons
    margin: 0 6px

    .v-btn
      margin-right: 10px

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: map-get($theme, 'cards-bg')

  .game-name
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    margin: -8px 8px 6px

    +theme using ($theme)
      color: map-get($theme, 'text-color')

  .game-header
    display: flex
    justify-content: space-between
    margin: -8px 8px 6px
    font-weight: 300
    font-size: 16px
    text-transform: uppercase

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  .game-slots
    display: flex
    margin: 0 8px 12px
    gap: 4px
    min-height: 43px

    &.full
      margin: 0 4px 12px

  .game-slot
    /* must not grow/shrink and must provide a positioning context */
    flex: 0 0 auto
    position: relative
    width: 36px
    height: 60px
    display: inline-block
    align-items: center
    justify-content: center
    overflow: hidden

    /* keep meeple size consistent */
    svg.meeple
      width: 36px
      height: 36px
      display: block

    &.local
      font-weight: bolder
      
      +theme using ($theme)
        color: map-get($theme, 'local-player-color')
      
    &.disconnected
      
      svg.meeple 
        fill: white
        
        +theme using ($theme)
          filter: map-get($theme, 'disconnected-filter')

.empty-message
  margin: 30px 0
  text-align: center
</style>
