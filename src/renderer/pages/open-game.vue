<template>
  <div class="open-game-view view">
  <GameSetupGrid v-if="loaded && gameId" :sets="sets" :rules="rules">
    <template #header>
      <div
        v-if="gameKey"
        class="game-name"
        :class="{ editable: isOwner && !readOnly }"
        @click.stop="showRenameDialog"
      >
        <v-icon v-if="isOwner && !readOnly">fas fa-pencil-alt</v-icon>
        {{ name }}
        <span v-if="!name" class="unnamed">{{ $t('game-setup.open-game.untitled-game') }}</span>
      </div>

      <HeaderMessage
        :sets="sets"
        :info="slotsReserved ? (!ai || slotsReservedByAI ? null : $t('game-setup.open-game.no-ai-in-game') ): (readOnly ? $t('game-setup.open-game.assign-all-players-to-start') : $t('game-setup.open-game.no-player-in-game') )"
      />

      <div v-if="gameKey" class="game-key">
        <v-tooltip bottom :open-delay="200">
          <template #activator="{ on, attrs }">
            <span
              class="key-title"
              v-bind="attrs"
              v-on="on"
            >
              <v-icon>far fa-question-circle</v-icon>
            </span>
          </template>
          <span>{{ $t('game-setup.open-game.share-the-key') }}</span>
        </v-tooltip>
        <strong class="game-key" @click="selectOnClick">{{ gameKey }}</strong>
      </div>

      <HeaderChangeSetupButton
        v-if="isOwner && !readOnly"
        :title="$t('button.change')"
        @click="changeGameSetup"
      />

      <HeaderGameButton
        v-if="isOwner"
        :title="$t('button.start')"
        :sets="sets"
        :disabled="(!ai && !slotsAssigned) || (ai && (!slotsReservedByAI || !slotsReserved))"
        @click="startGame"
      />

      <template v-else>
        <span class="text">{{ $t('game-setup.open-game.waiting-for-host-to-start-the-game') }}</span>
      </template>

      <HeaderLeaveGameButton :title="$t('menu.leave-game')" @click="leaveGame" />

    </template>

    <template #main>

      <div class="slots">
        <PlayerSlot
          v-for="slot in slots"
          :key="slot.number"
          :number="slot.number"
          :owner="slot.sessionId"
          :client="slot.clientId"
          :name="slot.name"
          :order="slot.order"
          :read-only="readOnly"
          :ai="slot.ai || false"
          :limit-reached="!!gameKey && localSlotsCount >= LOCAL_PLAYERS_LIMIT"
          :local-limit="LOCAL_PLAYERS_LIMIT"
        />
      </div>

      <v-dialog v-model="isRenameDialogOpen" max-width="600px">
        <v-card>
          <v-card-title>
            <span class="headline">{{ $t('game-setup.open-game.set-game-title') }}</span>
          </v-card-title>
          <v-card-text>
            <v-container>
              <v-text-field ref="gameTitleInput" v-model="editName" :label="$t('game-setup.open-game.name')" @keydown.enter="renameGame" />
            </v-container>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text @click="isRenameDialogOpen = false">{{ $t('button.cancel') }}</v-btn>
            <v-btn text @click="renameGame">{{ $t('button.confirm') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <template #detail>
      <div class="options">
        <h2>{{ $t('game-setup.open-game.options') }}</h2>
        <v-checkbox
          class="public-game"
          v-if="gameKey && !readOnly"
          v-model="publicGame"
          dense hide-details
          :label="$t('game-setup.open-game.public-game')"
          :disabled="!isOwner"
        />
        <v-checkbox
          v-if="!readOnly"
          v-model="randomizeSeating"
          dense hide-details
          :label="$t('game-setup.open-game.randomize-seating-order')"
          :disabled="!isOwner"
        />
        <v-checkbox
          v-model="puristTiles"
          dense hide-details
          :label="$t('game-setup.open-game.hide-remaining-tiles-cheat-sheet')"
          :disabled="readOnly || !isOwner"
        />
      </div>

      <GameSetupOverview :setup="setup" />

      <div v-if="gameKey" class="chat-section">
        <h2>{{ $t('chat.chat') }}</h2>
        <OpenGameChat />
      </div>
    </template>
  </GameSetupGrid>
  </div>
</template>

<script>
import { ipcRenderer } from 'electron'
import { mapGetters, mapState } from 'vuex'

import GameSetupOverview from '@/components/game-setup/overview/GameSetupOverview'
import GameSetupGrid from '@/components/game-setup/GameSetupGrid'
import HeaderGameButton from '@/components/game-setup/HeaderGameButton'
import HeaderChangeSetupButton from '@/components/game-setup/HeaderChangeSetupButton'
import HeaderLeaveGameButton from '@/components/game-setup/HeaderLeaveGameButton'
import HeaderMessage from '@/components/game-setup/HeaderMessage'
import OpenGameChat from '@/components/game-setup/OpenGameChat'
import PlayerSlot from '@/components/game-setup/PlayerSlot'

const LOCAL_PLAYERS_LIMIT = 4

export default {
  components: {
    GameSetupOverview,
    GameSetupGrid,
    HeaderChangeSetupButton,
    HeaderGameButton,
    HeaderLeaveGameButton,
    HeaderMessage,
    OpenGameChat,
    PlayerSlot
  },

  data () {
    return {
      LOCAL_PLAYERS_LIMIT,
      isRenameDialogOpen: false,
      editName: null,
      // do not update it after start when gameMessages are set to empty array
      readOnly: this.$store.state.game.gameMessages !== null
    }
  },

  computed: {
    ...mapState({
      ai: state => state.game.setup?.ai,
      gameKey: state => state.game.key,
      setup: state => state.game.setup,
      sets: state => state.game.setup?.sets,
      rules: state => state.game.setup?.rules,
      gameId: state => state.game.id,
      name: state => state.game.name,
      options: state => state.game.setup?.options,
      slots: state => state.game.slots,
      isOwner: state => state.game.owner === state.settings.clientId,
      sessionId: state => state.networking.sessionId
    }),

    ...mapGetters({
      loaded: 'loaded'
    }),

    slotsAssigned () {
      if (this.readOnly) {
        return !this.slots.find(slot => !slot.sessionId)
      } else {
        return !!this.slots.find(slot => slot.sessionId)
      }
    },

    slotsReserved () {
      return !!this.slots.find(slot => slot.clientId && !slot.ai)
    },

    slotsReservedByAI () {
      return !!this.slots.find(slot => slot.clientId && slot.ai)
    },

    localSlotsCount () {
      if (!this.slots || !this.sessionId) return 0
      return this.slots.filter(s => s.sessionId === this.sessionId).length
    },

    randomizeSeating: {
      set (value) {
        this.$store.commit('game/options', { randomizeSeating: value })
        this.$connection.send({
          type: 'GAME_OPTION',
          payload: {
            gameId: this.gameId,
            key: 'randomizeSeating',
            value
          }
        })
      },

      get () {
        return this.options.randomizeSeating
      }
    },

    publicGame: {
      set (value) {
        this.$store.commit('game/options', { publicGame: value })
        this.$connection.send({
          type: 'GAME_OPTION',
          payload: {
            gameId: this.gameId,
            key: 'publicGame',
            value
          }
        })
      },

      get () {
        return this.options.publicGame
      }
    },

    puristTiles: {
      set (value) {
        this.$store.commit('game/options', { puristTiles: value })
        this.$connection.send({
          type: 'GAME_OPTION',
          payload: {
            gameId: this.gameId,
            key: 'puristTiles',
            value
          }
        })
      },

      get () {
        return this.options.puristTiles
      }
    }
  },

  beforeCreate () {
    // useful for dev mode, reload on this page redirects back to home
    if (!this.$store.state.networking.connectionType) {
      this.$store.dispatch('game/close')
      this.$router.push('/')
    }
  },

  beforeDestroy () {
    this._onClose && this.$connection.off('close', this._onClose)
  },

  methods: {
    startGame () {
      this.$store.dispatch('game/start')
    },

    async changeGameSetup () {
      await this.$store.dispatch('gameSetup/changeGameSetup')
    },

    async leaveGame () {
      await ipcRenderer.emit('menu.leave-game')
    },

    renameGame () {
      this.$store.dispatch('game/rename', this.editName)
      this.isRenameDialogOpen = false
    },

    selectOnClick (ev) {
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ev.target)
      selection.removeAllRanges()
      selection.addRange(range)
    },

    showRenameDialog () {
      this.editName = this.name
      this.isRenameDialogOpen = true
      setTimeout(() => {
        this.$refs.gameTitleInput.focus()
        this.$refs.gameTitleInput.$el.querySelector('input').setAttribute('maxlength', 40)
      }, 1)
    }
  }
}
</script>

<style lang="sass" scoped>
*
  user-select: none

.open-game-view
  position: relative
  height: 100vh
  overflow: hidden

  ::v-deep .game-setup-grid
    height: 100%

  ::v-deep aside
    display: flex
    flex-direction: column
    height: 100%
    overflow: hidden

  @media (max-width: 1164px)
    ::v-deep aside
      flex-direction: row
      height: 33.333vh
      overflow: visible

    .options,
    .game-setup-overview,
    .chat-section
      flex: 0 0 33.333%
      height: 33.333vh
      overflow-y: auto

.game-name
  flex-grow: 1
  font-size: 20px
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

  &.editable
    cursor: pointer

  .v-icon
    position: relative
    margin-right: 10px
    top: -3px

  .unnamed
    font-style: italic

.game-key
  margin-right: 20px
  position: relative
  display: flex
  align-items: center

  .key-title
    opacity: 0.6

  strong
    font-size: 26px
    font-weight: 400
    letter-spacing: 0.5px
    margin-left: 10px
    padding: 4px 10px
    border-radius: 6px
    cursor: pointer
    white-space: nowrap

    +theme using ($theme)
      color: map-get($theme, 'text-color')
      background: map-get($theme, 'cards-selected-bg')

    
header .v-alert
  position: relative
  top: 8px
  width: 300px

main
  dislay: flex
  flex-order: start
  
.slots
  order: 1
  padding: 0 30px
  display: grid
  grid-template-columns: 1fr 1fr 1fr
  gap: 30px
  justify-content: center
  margin-top: 40px

h2
  font-weight: 300
  font-size: 16px
  text-transform: uppercase
  text-align: center

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.options
  flex: 0 0 33.333%
  padding: 30px 20px 20px
  order: 2
  overflow-y: auto
  box-sizing: border-box

.game-setup-overview
  flex: 0 0 33.333%
  overflow-y: auto
  box-sizing: border-box

  +theme using ($theme)
    background: map-get($theme, 'cards-bg')

  ::v-deep .rules
    padding-right: 20px
    font-size: 14px

    h2
      margin-right: -20px

.chat-section
  flex: 0 0 33.333%
  order: 3
  padding: 30px 20px 20px
  overflow: hidden
  box-sizing: border-box
  display: flex
  flex-direction: column

  .open-game-chat
    flex: 1 1 0
    min-height: 0

.game-key
  user-select: text

@media (max-width: 1079px)
  .slots
    grid-template-columns: 1fr 1fr

@media (max-width: 919px)
  .slots
    grid-template-columns: 1fr

@media (max-height: 768px)
  .slots
    order: 2
    margin-top: 20px

  .options
    order: 1
    padding-top: 15px

  .chat-section
    padding-top: 15px
</style>