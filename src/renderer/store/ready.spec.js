import { describe, it, expect } from 'vitest'

import { mutations } from '@/store/game'

// READY {gameId, ready: [slot numbers]} from the server: exactly these seats are ready
describe('slotsReady', () => {
  const slots = () => [
    { number: 0, clientId: 'host' },
    { number: 1, clientId: 'bob', ready: true },
    { number: 2, clientId: 'carol' }
  ]

  it('marks exactly the listed seats ready', () => {
    const state = { id: 'g1', slots: slots() }
    mutations.slotsReady(state, { gameId: 'g1', ready: [2] })
    expect(state.slots.map(s => !!s.ready)).toEqual([false, false, true])
  })

  it('clears every seat on an empty list', () => {
    const state = { id: 'g1', slots: slots() }
    mutations.slotsReady(state, { gameId: 'g1', ready: [] })
    expect(state.slots.some(s => s.ready)).toBe(false)
  })

  it('ignores another game', () => {
    const state = { id: 'g1', slots: slots() }
    mutations.slotsReady(state, { gameId: 'other', ready: [] })
    expect(state.slots[1].ready).toBe(true)
  })
})
