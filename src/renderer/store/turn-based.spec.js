import { describe, it, expect } from 'vitest'

import { activeTimer, computeClock, getters, leaveTimedGameTexts } from '@/store/game'

const timer = { initial: 60, turn: 0 }

describe('activeTimer', () => {
  it('is the setup timer until everyone agreed to turn-based', () => {
    expect(activeTimer({ timer, options: {} })).toBe(timer)
    expect(activeTimer({ timer, options: { timerOff: true } })).toBe(null)
    expect(activeTimer({ timer: null, options: {} })).toBe(null)
    expect(activeTimer(null)).toBe(null)
  })

  it('turn-based: nobody loses on time on a replay', () => {
    // player 0 takes 120 s of a 60 s limit
    const messages = [{ player: 0, clock: 0 }, { player: 1, clock: 120000 }]
    expect(computeClock(2, messages, timer).timedOut).toBe(0)
    expect(computeClock(2, messages, activeTimer({ timer, options: { timerOff: true } })).timedOut).toBe(null)
  })
})

describe('canProposeTurnBased', () => {
  const state = (extra = {}) => ({
    id: 'g',
    key: 'ABCDEF',
    gameMessages: [],
    resignation: null,
    phase: 'ActionPhase',
    timedOut: null,
    setup: { timer, options: {} },
    slots: [{ number: 0, clientId: 'me' }, { number: 1, clientId: 'bob' }],
    ...extra
  })
  const can = (st, me = 'me') => getters.canProposeTurnBased(st, { turnBasedProposal: getters.turnBasedProposal(st) }, { settings: { clientId: me } })

  it('a seated player leaving a running online game with a time limit', () => {
    expect(can(state())).toBe(true)
  })

  it('not without a time limit, nor once it is off', () => {
    expect(can(state({ setup: { timer: null, options: {} } }))).toBe(false)
    expect(can(state({ setup: { timer, options: { timerOff: true } } }))).toBe(false)
  })

  it('not while a proposal is open; again after a decline', () => {
    expect(can(state({ setup: { timer, options: { turnBasedProposal: { status: 'open' } } } }))).toBe(false)
    expect(can(state({ setup: { timer, options: { turnBasedProposal: { status: 'declined' } } } }))).toBe(true)
  })

  it('not before the start, at the end, after a resignation or once somebody lost on time', () => {
    expect(can(state({ gameMessages: null }))).toBe(false)
    expect(can(state({ phase: 'GameOverPhase' }))).toBe(false)
    expect(can(state({ resignation: {} }))).toBe(false)
    expect(can(state({ timedOut: 1 }))).toBe(false)
  })

  it('not for a watcher, nor in a local game', () => {
    expect(can(state(), 'watcher')).toBe(false)
    expect(can(state({ key: null }))).toBe(false)
  })
})

describe('turnBasedBlockers', () => {
  it('names the players whose app cannot do turn-based (once per player, the human seat)', () => {
    const slots = [
      { number: 0, clientId: 'me', name: 'Me', canTurnBased: true },
      { number: 1, clientId: 'old', name: 'Olga' },
      { number: 2, clientId: 'old', name: 'Adda1', ai: true },
      { number: 3 }
    ]
    expect(getters.turnBasedBlockers({ slots })).toEqual(['Olga'])
    expect(getters.turnBasedBlockers({ slots: [slots[0]] })).toEqual([])
  })

  it('with one, the leave dialog has no Propose and says why', () => {
    const t = leaveTimedGameTexts((k, p) => k + (p ? ':' + p.names : ''), ['Olga'])
    expect(t.propose).toBe(null)
    expect(t.detail).toBe('game.turn-based.old-app:Olga')
  })
})

describe('leaveTimedGameTexts', () => {
  it('the dialog buttons: propose and leave / leave anyway / continue playing', () => {
    const t = leaveTimedGameTexts(k => k)
    expect([t.propose, t.leave, t.cancel]).toEqual([
      'game.turn-based.propose-and-leave',
      'game.turn-based.leave-anyway',
      'dialog.close-local-game.continue-playing'
    ])
  })
})
