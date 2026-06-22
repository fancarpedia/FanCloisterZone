import Vue from 'vue'

// Pre-draw secret state (client side). The server sends the local player ONLY their own drawn
// tiles (PRE_DRAW_RESULT, private) and broadcasts opponents' hand sizes (PRE_DRAW_PUBLIC, no id).
// So `myHand` holds tile ids the local player legitimately knows; `counts` holds the public
// per-seat hand sizes. The engine never sees the secret ids — placement is an atomic public reveal.
export const state = () => ({
  myHand: [],   // tile ids the local player holds (secret to opponents)
  counts: {},   // seat(number) -> public hand size
  revealed: [], // { seat, tileId, position?, rotation? } public reveals
  selected: null, // { tileId, options } the hand tile currently picked for board placement
  handMax: 0,   // N = max regular hand (public; from the redacted GAME payload)
  mySeat: null, // our engine player index (from the redacted GAME)
  abbeyPassed: false // we passed the abbey this turn → pre-draw cap is back to N
})

export const mutations = {
  reset (state) {
    state.myHand = []
    state.counts = {}
    state.revealed = []
    state.selected = null
    state.handMax = 0
    state.mySeat = null
    state.abbeyPassed = false
  },
  setSelected (state, selected) {
    state.selected = selected
  },
  setMySeat (state, seat) {
    state.mySeat = (seat === undefined ? null : seat)
  },
  setAbbeyPassed (state, val) {
    state.abbeyPassed = !!val
  },
  setHand (state, hand) {
    state.myHand = Array.isArray(hand) ? [...hand] : []
  },
  setCounts (state, counts) {
    state.counts = counts && typeof counts === 'object' ? { ...counts } : {}
  },
  setHandMax (state, handMax) {
    state.handMax = handMax || 0
  },
  addToHand (state, tileId) {
    state.myHand = [...state.myHand, tileId]
  },
  removeFromHand (state, tileId) {
    const i = state.myHand.indexOf(tileId)
    if (i >= 0) {
      const h = [...state.myHand]
      h.splice(i, 1)
      state.myHand = h
    }
  },
  setCount (state, { seat, count }) {
    Vue.set(state.counts, seat, count)
  },
  addReveal (state, payload) {
    state.revealed = [...state.revealed, payload]
  }
}

export const actions = {
  // Seed the secret-hand UI from a redacted GAME payload (initial start + reconnection): the server
  // sends THIS client its own `myHand` plus public `handCounts`/`handMax`.
  handleGame ({ commit }, payload) {
    commit('setHandMax', payload.handMax)
    commit('setHand', payload.myHand || [])
    commit('setCounts', payload.handCounts || {})
    commit('setMySeat', payload.mySeat)
    commit('setAbbeyPassed', false)
  },

  // outgoing (client -> server) — draw one tile into the secret hand (server enforces the cap).
  requestPreDraw ({ rootState }) {
    this._vm.$connection.send({ type: 'PRE_DRAW', payload: { gameId: rootState.game.id } })
  },

  // Decline the abbey this turn: server raises the cap to N and deals the held-back tile.
  passAbbey ({ rootState }) {
    this._vm.$connection.send({ type: 'PASS_ABBEY', payload: { gameId: rootState.game.id } })
  },
  placePreDrawn ({ commit }, payload) {
    this._vm.$connection.send({ type: 'PLACE_PREDRAWN', payload })
    commit('setSelected', null)
  },

  // Pick a secret hand tile to place: ask the engine (non-mutating %placements query) for its
  // legal placements on the current board, then expose it as the active placement so the board
  // shows the ghost + options (the tile is in the public pack, so this leaks nothing).
  async selectForPlacement ({ commit }, { index, tileId }) {
    const engine = this._vm.$engine.get()
    if (!engine) return
    let options = []
    try {
      const { response } = await engine.query('%placements ' + tileId)
      if (response && response.type === 'PLACEMENTS' && Array.isArray(response.options)) {
        options = response.options
      }
    } catch (e) {
      console.error('pre-draw %placements query failed', e)
    }
    // Select by hand INDEX (tileId can be duplicated in hand) — only this entry activates.
    commit('setSelected', { index, tileId, options })
  },

  clearSelection ({ commit }) {
    commit('setSelected', null)
  },

  // incoming (server -> client), wired from store/networking.js
  handleResult ({ commit }, payload) {
    commit('addToHand', payload.tileId) // PRIVATE: only this client receives it
  },
  handlePublic ({ commit }, payload) {
    commit('setCount', { seat: payload.seat, count: payload.count }) // PUBLIC: no tile id
  },
  // PASS_ABBEY_PUBLIC: someone passed their abbey this turn. If it's us, raise our local cap to N.
  handlePassAbbey ({ commit, state }, payload) {
    if (payload.seat === state.mySeat) commit('setAbbeyPassed', true)
  },
  // A PLACE_PREDRAWN engine message revealed+placed a tile: update the secret-hand UI.
  // (The engine itself applies the board placement; this only keeps our hand/counts in sync.)
  handlePlaced ({ commit, state }, { player, tileId }) {
    commit('addReveal', { seat: player, tileId })
    // Only our OWN placement touches our hand/selection — gate on seat, not tileId (tiles can be
    // duplicated across hands, so matching by id would wrongly drop our tile on an opponent's reveal).
    if (player === state.mySeat) {
      commit('removeFromHand', tileId) // it was ours, now public
      commit('setSelected', null)
    }
    commit('setCount', { seat: player, count: Math.max(0, (state.counts[player] || 0) - 1) })
  }
}
