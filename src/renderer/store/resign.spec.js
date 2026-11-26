import { describe, it, expect } from 'vitest'

import { resignResults, getters, actions } from '@/store/game'

// Resigning: every seat of the resigning client goes last (flagged), everyone else keeps their
// order by points — the resigning player loses whatever their points.
const state = {
  timedOut: null,
  setup: { timer: null },
  players: [
    { name: 'Alice', clientId: 'a', points: 12 },
    { name: 'Bob', clientId: 'b', points: 30 },
    { name: 'Bob AI', clientId: 'b', points: 5 },
    { name: 'Carol', clientId: 'c', points: 12 }
  ]
}

describe('resignResults', () => {
  it('puts the resigned seats last and ranks the rest by points', () => {
    const results = resignResults(state, getters.ranks(state), [1, 2])
    expect(results.map(r => [r.name, r.position, r.resigned])).toEqual([
      ['Alice', 1, false],
      ['Carol', 1, false], // a tie keeps the shared first place
      ['Bob', 3, true],
      ['Bob AI', 3, true]
    ])
  })

  it('makes the best of the others the winner even if a resigned player had more points', () => {
    const results = resignResults(state, getters.ranks(state), [1, 2])
    expect(results.find(r => r.position === 1 && !r.resigned).name).toBe('Alice')
  })
})

// GAME_RESIGNED names the resigning seats by SLOT number (colour seat); the client works with PLAYER
// indexes. Using the slot number as an index crashed the panel ("reading 'slot'" of undefined).
describe('handleResigned', () => {
  it('turns the server slot numbers into player indexes', () => {
    const committed = []
    const st = {
      id: 'g1',
      players: [{ slot: 2 }, { slot: 5 }, { slot: 7 }]
    }
    actions.handleResigned({
      state: st,
      commit: (type, value) => committed.push([type, value]),
      rootState: { settings: { clientId: 'me' } }
    }, { gameId: 'g1', clientId: 'bob', name: 'Bob', seats: [5, 7], results: [] })
    expect(committed[0][0]).toBe('resignation')
    expect(committed[0][1].seats).toEqual([1, 2])
    expect(committed[0][1].mine).toBe(false)
  })

  // a resigned game opened later (GAME with state FX): the players are not built yet, so the seats
  // come from the result's resigned flags (player indexes)
  it('takes the resigned seats from the result when the game has no players yet', () => {
    const committed = []
    actions.handleResigned({
      state: { id: 'g1', players: [] },
      commit: (type, value) => committed.push([type, value]),
      rootState: { settings: { clientId: 'bob--w2' } }
    }, {
      gameId: 'g1',
      clientId: 'bob',
      name: 'Bob',
      seats: [3],
      results: [
        { seat: 0, name: 'Alice', position: 1, resigned: false },
        { seat: 1, name: 'Bob', position: 2, resigned: true }
      ]
    })
    expect(committed[0][1].seats).toEqual([1])
    expect(committed[0][1].mine).toBe(true)
  })
})

describe('resignDialogTexts', () => {
  it('uses the close-local-game dialog buttons: Resign / Continue Playing', async () => {
    const { resignDialogTexts } = await import('@/store/game')
    expect(resignDialogTexts(k => k)).toEqual({
      title: 'menu.resign-game',
      message: 'game.resign.confirm',
      confirm: 'game.resign.resign',
      cancel: 'dialog.close-local-game.continue-playing'
    })
  })
})
