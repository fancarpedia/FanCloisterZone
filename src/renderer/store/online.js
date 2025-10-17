
export const state = () => ({
  gameList: [],
  gamePublicList: []
})

export const mutations = {
  gameList (state, value) {
    state.gameList = value
  },
  gamePublicList (state, value) {
    state.gamePublicList = value
  }
}

export const actions = {
  onClose ({ commit }) {
    commit('gameList', []),
    commit('gamePublicList', [])
  },

  gameUpdate ({ state, commit }, payload) {
    console.log('TODO handle GAME_UPDATE', payload)
  }
}
