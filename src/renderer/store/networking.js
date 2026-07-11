import last from 'lodash/last'

import { ENGINE_MESSAGES } from '@/constants/messages'
import { connectExceptionToMessage } from '@/utils/networking'
import { claimableRematchSlots } from '@/store/rematch'

export const STATUS_CONNECTING = 'connecting'
export const STATUS_RECONNECTING = 'reconnecting'
export const STATUS_CONNECTED = 'connected'

let reconnectTimeout = null
// The host/connectionType of the connection we're currently retrying, so `reconnectNow`
// (fired when the OS network comes back) can skip the backoff and retry straight away.
let scheduledReconnect = null

// Where "go home" leads. Game windows return to '/' so the windowing guard can tear them
// down; the lobby ('main') window stays in the online lobby ('/online', the default screen).
function homeRoute ($windows) {
  return ($windows && $windows.isGameWindow && $windows.isGameWindow()) ? '/' : '/online'
}

class ConnectionHandler {
  constructor (ctx, host, $router, $addons, $connection, resolve, $windows) {
    this.ctx = ctx
    this.host = host
    this.$router = $router
    this.$addons = $addons
    this.$connection = $connection
    this.resolve = resolve
    this.$windows = $windows
    this.messageBuffer = []
    this.onMessageLock = false
  }

  async onMessage (message) {
    this.messageBuffer.push(message)
    if (!this.onMessageLock) {
      this.onMessageLock = true
      while (this.messageBuffer.length) {
        const m = this.messageBuffer.shift()
        try {
          await this.processMessage(m)
        } catch (e) {
          console.error('processMessage error', e)
        }
      }
      this.onMessageLock = false
    }
  }

  async processMessage (message) {
    const { commit, state, dispatch, rootState } = this.ctx
    const { type, payload } = message
	if (type === 'ERROR') {
	  // Handle engine error gracefully
	  const { commit } = this.ctx
	  commit('errorMessage', { 
	    title: 'Game Error', 
	    content: payload.message 
	  }, { root: true })
	  return
	}
	if (ENGINE_MESSAGES.has(type)) {
      if (type === 'PLACE_PREDRAWN') {
        // reveal of a pre-drawn tile: update the secret-hand UI, then let the engine place it
        await dispatch('predraw/handlePlaced', { player: message.player, tileId: payload.tileId }, { root: true })
      }
      await dispatch('game/handleEngineMessage', message, { root: true })
    } else if (type === 'WELCOME') {
      const reconnected = !!state.reconnectAttempt
      commit('sessionId', payload.sessionId)
      commit('connectionStatus', STATUS_CONNECTED)
      commit('reconnectAttempt', null)
      if (!reconnected) {
        commit('globalChat/reset', null, { root: true }) // fresh connect: start with an empty lobby chat
      }
      if (state.connectionType === 'online') {
        if (reconnected && rootState.game.id) {
          const payload = { gameId: rootState.game.id }
          const lastMsg = last(rootState.game.gameMessages)
          if (lastMsg) {
            payload.lastMessage = {
              id: lastMsg.id,
              seq: lastMsg.seq
            }
          }
          await this.$connection.send({
            type: 'JOIN_GAME',
            payload
          })
        } else if (!this.$windows || !this.$windows.isGameWindow()) {
          // lobby window: connecting lands on the online lobby. A game window connects only
          // as a step of joining/creating a game — it stays on the loading page until the
          // GAME/START messages route it, instead of flashing the lobby.
          this.$router.push('/online')
        }
      }
      this.resolve()
    } else if (type === 'GAME_LIST') {
      commit('online/gameList', payload.games, { root: true })
    } else if (type === 'GAME_PUBLIC_LIST') {
      commit('online/gamePublicList', payload.games, { root: true })
    } else if (type === 'SLOT') {
      await dispatch('game/handleSlotMessage', payload, { root: true })
    } else if (type === 'START') {
      await dispatch('game/handleStartMessage', message, { root: true })
      if (!rootState.runningTests) {
        this.$router.push('/game')
      }
    } else if (type === 'RENAME_GAME') {
      if (payload.gameId === rootState.game.id) {
        commit('game/name', payload.name, { root: true })
      }
    } else if (type === 'GAME') {
      if (payload.setup.addons) {
        const missing = this.$addons.findMissingAddons(payload.setup.addons)
        if (missing.length) {
          await dispatch('close')
          const msg = `Remote game requires addon(s) which are not installed:\n\n${missing.join(', ')}`
          commit('errorMessage', { title: 'Missing addons', content: msg }, { root: true })
          return
        }
      }

      if (payload.replay === true) {
        payload.replay = rootState.game.gameMessages
      }

      await dispatch('game/handleGameMessage', payload, { root: true })
      if (payload.state === 'R' || payload.state === 'F') { // running or finished
        await dispatch('game/handleStartMessage', {
          clock: message.clock,
          id: null,
          payload: {}
        }, { root: true })

        if (!rootState.runningTests) {
          if (this.$router.currentRoute.path !== '/game') {
            commit('board/reset', null, { root: true })
            commit('predraw/reset', null, { root: true })
            this.$router.push('/game')
          }
        }
      } else {
        commit('board/reset', null, { root: true })
        commit('predraw/reset', null, { root: true })
        if (!rootState.runningTests) {
          this.$router.push('/open-game')
          // online-hotseat rematch: take the previous seats in the new (swapped) order — the
          // server assigns seating by TAKE_SLOT sequence
          const rematchSlots = rootState.gameSetup.rematchSlots
          if (rematchSlots && rematchSlots.length && !payload.replay) {
            commit('gameSetup/rematchSlots', null, { root: true })
            for (const rs of claimableRematchSlots(rematchSlots, payload.slots)) {
              await dispatch('gameSetup/takeSlot', { number: rs.number, name: rs.name }, { root: true })
            }
            return
          }
          const { preferredColor } = rootState.settings
          if (preferredColor !== null && !payload.replay) {
            // player has auto assign enabled and game is a new game
            const slot = payload.slots.find(s => s.number === preferredColor && !s.clientId)
            if (slot) {
              await dispatch('gameSetup/takeSlot', { number: slot.number }, { root: true })
            }
          }
        }
      }
      // Pre-draw: seed the secret-hand UI from the redacted GAME (our own myHand + public counts/handMax).
      if (payload.preDraw) {
        await dispatch('predraw/handleGame', payload, { root: true })
      }
    } else if (type === 'GAME_UPDATE') {
      commit('game/updateSetup', payload.setup, { root: true })
      // Live setup edits arrive continuously: don't yank the editing owner off /game-setup,
      // and don't re-navigate players who are already on the slot page.
      const path = this.$router.currentRoute.path
      if (!rootState.gameSetup.editingGameId && path !== '/open-game') {
        this.$router.push('/open-game')
      }
    } else if (type === 'GAME_OPTION') {
      commit('game/options', { [payload.key]: payload.value }, { root: true })
    } else if (type === 'GAME_CHAT') {
      commit('game/chatCommit', { message: payload }, { root: true })
    } else if (type === 'GLOBAL_CHAT') {
      await dispatch('globalChat/handleMessage', payload, { root: true })
    } else if (type === 'ALERT') {
      commit('online/alertMessage', { message: payload }, { root: true })
    } else if (type === 'PRE_DRAW_RESULT') {
      await dispatch('predraw/handleResult', payload, { root: true })
    } else if (type === 'PRE_DRAW_PUBLIC') {
      await dispatch('predraw/handlePublic', payload, { root: true })
    } else if (type === 'PASS_ABBEY_PUBLIC') {
      await dispatch('predraw/handlePassAbbey', payload, { root: true })
    } else if (type === 'COOP_LEADERBOARD') {
      // Keep Building (coop variant) best-setups list for the game-setup Variant tab
      commit('gameSetup/coopLeaderboard', payload.items || [], { root: true })
    } else if (type === 'STANDARD_POPULAR') {
      // most-played standard setups for the game-setup Variant tab
      commit('gameSetup/standardPopular', payload.items || [], { root: true })
    } else {
      console.error(payload)
//      throw new Error(`Unhandled message ${type}`)
    }
  }

  async onClose (errCode) {
    const { state, commit, dispatch } = this.ctx
    const reconnecting = state.connectionStatus === STATUS_RECONNECTING
    if ([1001, 1006, 1007, 4001].includes(errCode) || reconnecting) {
      const attempt = reconnecting ? state.reconnectAttempt + 1 : 1
      let delay
      if (attempt === 1) {
        delay = 250
      } else if (attempt < 3) {
        delay = 1000
      } else if (attempt <= 5) {
        delay = 2000
      } else {
        delay = 6000
      }
      commit('connectionStatus', STATUS_RECONNECTING)
      commit('reconnectAttempt', attempt)
      scheduledReconnect = { host: this.host, connectionType: state.connectionType }
      console.log(`Connection interrupted. Next attempt (${attempt}) in ${delay}ms`)
      reconnectTimeout = setTimeout(async () => {
        reconnectTimeout = null
        try {
          await dispatch('connect', { host: this.host, connectionType: state.connectionType })
        } catch (err) {
          if (!err.error?.errno) {
            // unexpected error
            console.error(err)
          }
          // do nothing, reconnect is handled from on Close
        }
      }, delay)
    } else {
      if (state.connectionType === 'online') {
        await dispatch('online/onClose', null, { root: true })
        const home = homeRoute(this.$windows)
        if (this.$router.currentRoute.path !== home) {
          this.$router.push(home)
        }
      }
      commit('connectionStatus', null)
    }
  }
}

export const state = () => ({
  sessionId: null,
  connectionType: null, // direct / online
  connectionStatus: null,
  reconnectAttempt: null,
  onlineEntry: null, // 'fan' / 'plain' — which online entry point opened the current connection (for reconnect)
  // set when the USER pressed Disconnect — suppresses the lobby's auto-connect (which otherwise
  // re-fires from its engine/settings watchers and silently reconnects); any connect resets it
  userDisconnected: false
})

export const mutations = {
  sessionId (state, sessionId) {
    state.sessionId = sessionId
  },

  connectionType (state, connectionType) {
    state.connectionType = connectionType
  },

  connectionStatus (state, value) {
    state.connectionStatus = value
  },

  userDisconnected (state, value) {
    state.userDisconnected = value
  },

  reconnectAttempt (state, value) {
    state.reconnectAttempt = value
  },

  onlineEntry (state, value) {
    state.onlineEntry = value
  }
}

export const actions = {
  async startServer ({ state, commit, dispatch }, game) {
    // `game.local` forces the embedded server (used for test-scenario replay), which must run
    // locally even when this window happens to be connected to the online server.
    if (state.connectionType === 'online' && !game.local) {
      const { $connection } = this._vm
      $connection.send({
        type: 'CREATE_GAME',
        payload: {
          name: '',
          setup: game.setup,
          slots: game.slots.length,
		  gameAnnotations: game.gameAnnotations || null
        }
      })
    } else {
      const { $server, $connection } = this._vm
      // Drop the online socket first (detaching its handlers) so the direct connection below
      // replaces it cleanly instead of the stale online onclose tearing down the new socket.
      if (state.connectionType === 'online') {
        $connection.disconnect()
        commit('connectionType', null)
        commit('connectionStatus', null)
      }
      // Pre-draw is server-authoritative (online-only); never run it on the embedded local server.
      if (game.setup && game.setup.elements && game.setup.elements['pre-draw']) {
        game = { ...game, setup: { ...game.setup, elements: { ...game.setup.elements } } }
        delete game.setup.elements['pre-draw']
      }
      const { port } = await $server.start(game)
      try {
        // Connect to the per-window embedded server on the port it was assigned.
        await dispatch('connect', { host: 'localhost:' + port, connectionType: 'direct' })
      } catch (err) {
        console.error(err)
        commit('errorMessage', { title: 'Engine error', content: err.message || err + '' }, { root: true })
      }
    }
  },

  async connect (ctx, { host, connectionType }) {
    const { state, commit, rootState } = ctx
    commit('userDisconnected', false) // any connect (user or auto) clears the disconnect intent
    if (state.connectionStatus !== STATUS_RECONNECTING) {
      commit('connectionType', connectionType)
      commit('connectionStatus', STATUS_CONNECTING)
    }
    const { $connection, $addons, $windows } = this._vm
    if (!host.match(/:\d+/) && connectionType === 'direct') {
      host = `${host}:${rootState.settings.port}`
    }
    if (!host.match(/^\w+:\/\//)) {
      host = 'ws://' + host
    }
    rootState.onlineHostName = (new URL(host)).hostname
    return new Promise((resolve, reject) => {
      const handler = new ConnectionHandler(ctx, host, this.$router, $addons, $connection, resolve, $windows)
      $connection.connect(host, {
        onMessage: handler.onMessage.bind(handler),
        onClose: handler.onClose.bind(handler)
      }).catch(err => {
        if (state.connectionStatus !== STATUS_RECONNECTING) {
          commit('connectionType', null)
          commit('connectionStatus', null)
        }
        reject(err)
      })
    })
  },

  async connectPlayOnline ({ dispatch, commit, rootState }) {
    const s = rootState.settings
    commit('onlineEntry', 'plain')
    // dev "Use Local Play Online": go to the local server when on, else the configured URL.
    const host = s.localPlayOnline ? s.localPlayOnlineUrl : s.playOnlineUrl
    if (host) {
      try {
        await dispatch('connect', { host, connectionType: 'online' })
      } catch (e) {
        const title = e.type === 'ERR' ? 'Connection has been rejected.' : 'Unable to connect'
        const content = connectExceptionToMessage(e)
        commit('errorMessage', { title, content }, { root: true })
        console.error(e)
      }
    }
  },

  async connectPlayOnlineFan ({ dispatch, commit, rootState }, { silent } = {}) {
    const s = rootState.settings
    commit('onlineEntry', 'fan')
    // dev "Use Local Play Online": go to the local server when on, else the configured Fan URL.
    const host = s.localPlayOnline ? s.localPlayOnlineUrl : s.playOnlineFanURL
    if (host) {
      try {
        await dispatch('connect', { host, connectionType: 'online' })
      } catch (e) {
        // Silent mode is used by the lobby's automatic startup connect: if the server is
        // unreachable we stay on /online in offline state without an error dialog. Manual
        // connect attempts still surface the error.
        if (!silent) {
          const title = e.type === 'ERR' ? 'Connection has been rejected.' : 'Unable to connect'
          const content = connectExceptionToMessage(e)
          commit('errorMessage', { title, content }, { root: true })
        }
        console.error(e)
      }
    }
  },

  // Fired when the OS reports the network is back (window 'online' event): skip the remaining
  // reconnect backoff and retry at once. Only acts while we're waiting between attempts (a
  // pending timeout) — never mid-attempt, to avoid opening a duplicate socket.
  reconnectNow ({ state, dispatch }) {
    if (state.connectionStatus !== STATUS_RECONNECTING) return
    if (!reconnectTimeout || !scheduledReconnect) return
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
    const { host, connectionType } = scheduledReconnect
    console.log('Network back — reconnecting immediately')
    dispatch('connect', { host, connectionType }).catch(err => {
      // a failed immediate attempt just reschedules via onClose
      if (!err.error?.errno) {
        console.error(err)
      }
    })
  },

  // Bounce the current online connection to whatever the online target now resolves to
  // (used when the dev "Use Local Play Online" toggle changes the target server).
  async reconnectOnline ({ state, dispatch }) {
    if (state.connectionType !== 'online') return
    const entry = state.onlineEntry
    await dispatch('close')
    if (entry === 'plain') {
      await dispatch('connectPlayOnline')
    } else {
      await dispatch('connectPlayOnlineFan')
    }
  },

  // `redirect: false` closes the connection without navigating — used by play-again/rematch,
  // which immediately start a new game in the SAME window (in a game window the default
  // navigation to '/' would trigger the windowing guard and close the window).
  close ({ commit, rootState }, options) {
    // `userIntent: true` = the user pressed Disconnect — remember it so the lobby's
    // auto-connect doesn't silently reconnect right after (its engine/settings watchers re-fire)
    const { redirect = true, userIntent = false } = options || {} // dispatch payload may be null, not just undefined
    if (userIntent) {
      commit('userDisconnected', true)
    }
    const { $server, $connection } = this._vm
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    scheduledReconnect = null
    $connection.disconnect()
    $server.stop()
    commit('connectionType', null)
    commit('connectionStatus', null)
    commit('reconnectAttempt', null)
    commit('onlineEntry', null)
    if (redirect && !rootState.runningTests) {
      // Game windows go to '/' (windowing guard closes them); the lobby stays on /online.
      const home = homeRoute(this._vm.$windows)
      if (this.$router.currentRoute.path !== home) {
        this.$router.push(home)
      }
    }
  }
}
