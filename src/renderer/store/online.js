
export const state = () => ({
  alertMessage: null,
  gameList: [],
  gamePublicList: [],
  // connected clients (server-pushed): [{ clientId, name, playing }] — playing = in a game, else idle
  connectedClients: []
})

export const mutations = {
  alertMessage (state, value) {
    state.alertMessage = value
  },
  gameList (state, value) {
    state.gameList = value
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
