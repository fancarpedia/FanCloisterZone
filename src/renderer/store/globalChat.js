export const state = () => ({
  messages: [] // { clientId, name, message, timestamp } received this session
})

export const mutations = {
  reset (state) {
    state.messages = []
  },
  add (state, message) {
    state.messages = [...state.messages, message]
  }
}

export const actions = {
  // outgoing (client -> server): the server fills in name/clientId/timestamp and broadcasts to all.
  send ({ rootState }, message) {
    const text = (message || '').trim()
    if (!text) return
    this._vm.$connection.send({ type: 'GLOBAL_CHAT', payload: { message: text } })
  },

  // incoming (server -> client), wired from store/networking.js
  handleMessage ({ commit }, payload) {
    commit('add', payload)
  }
}
