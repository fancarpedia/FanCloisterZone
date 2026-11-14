import { describe, it, expect } from 'vitest'

import { actions, mutations } from './game'

// "AI player" on an empty seat is two requests: take the seat, then make it AI. The seat must not
// show as a human in between (that flashed a chat send button and the "local player" label).

const setup = () => {
  const state = {
    gameMessages: null,
    pendingAiSlots: {},
    slots: [{ number: 0 }, { number: 1 }]
  }
  const commit = (type, payload) => mutations[type](state, payload)
  const handle = payload => actions.handleSlotMessage({ state, commit }, payload)
  return { state, commit, handle }
}

describe('a seat on its way to becoming an AI player', () => {
  it('shows as AI from the first reply (the take) on', () => {
    const { state, commit, handle } = setup()
    commit('pendingAiSlot', { number: 1, pending: true })
    handle({ number: 1, sessionId: 'me', clientId: 'A', ai: false })
    expect(state.slots[1].ai).toBe(true)
    expect(state.pendingAiSlots[1]).toBe('taken')
  })

  it('the AI seat itself then ends the wait', () => {
    const { state, commit, handle } = setup()
    commit('pendingAiSlot', { number: 1, pending: true })
    handle({ number: 1, sessionId: 'me', clientId: 'A', ai: false })
    handle({ number: 1, sessionId: 'me', clientId: 'A', ai: true, name: 'Adda1' })
    expect(state.slots[1]).toMatchObject({ ai: true, name: 'Adda1' })
    expect(state.pendingAiSlots[1]).toBeUndefined()
  })

  it('a refusal (the seat stays human) is shown as it is, not as AI', () => {
    const { state, commit, handle } = setup()
    commit('pendingAiSlot', { number: 1, pending: true })
    handle({ number: 1, sessionId: 'me', clientId: 'A', ai: false })
    handle({ number: 1, sessionId: 'me', clientId: 'A', ai: false })
    expect(state.slots[1].ai).toBe(false)
    expect(state.pendingAiSlots[1]).toBeUndefined()
  })

  it('other seats are not touched', () => {
    const { state, commit, handle } = setup()
    commit('pendingAiSlot', { number: 1, pending: true })
    handle({ number: 0, sessionId: 'me', clientId: 'A', ai: false })
    expect(state.slots[0].ai).toBe(false)
    expect(state.pendingAiSlots[1]).toBe(true)
  })
})
