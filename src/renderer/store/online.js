
export const state = () => ({
  alertMessage: null,
  gameList: [],
  gamePublicList: []
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
  }
}

export const actions = {
  onClose ({ commit }) {
    commit('alertMessage', null),
    commit('gameList', []),
    commit('gamePublicList', [])
  },

  gameUpdate ({ state, commit }, payload) {
    console.log('TODO handle GAME_UPDATE', payload)
  }
}
