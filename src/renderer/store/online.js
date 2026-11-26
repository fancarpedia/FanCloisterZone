
export const state = () => ({
  alertMessage: null,
  gameList: [],
  // resigned games this client dismissed (✕ in the lobby): hidden at once and in every later
  // GAME_LIST, whatever the server's list still carries
  dismissedResigned: [],
  gamePublicList: [],
  // connected clients (server-pushed): [{ clientId, name, playing }] — playing = in a game, else idle
  connectedClients: []
})

export const mutations = {
  alertMessage (state, value) {
    state.alertMessage = value
  },
  gameList (state, value) {
    const dismissed = state.dismissedResigned
    state.gameList = dismissed.length
      ? (value || []).filter(g => !(g.state === 'FX' && dismissed.includes(g.gameId)))
      : value
  },
  dismissResigned (state, gameId) {
    if (!state.dismissedResigned.includes(gameId)) state.dismissedResigned.push(gameId)
    state.gameList = state.gameList.filter(g => g.gameId !== gameId)
  },
  gamePublicList (state, value) {
    state.gamePublicList = value
  },
  connectedClients (state, value) {
    state.connectedClients = value
  }
}

export const actions = {
  onClose ({ commit }) {
    commit('alertMessage', null)
    commit('gameList', [])
    commit('gamePublicList', [])
    commit('connectedClients', [])
  }

}
