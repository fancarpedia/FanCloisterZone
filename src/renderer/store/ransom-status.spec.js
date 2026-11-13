import { describe, it, expect } from 'vitest'

import { getters } from './game'
import en from '@/locales/en.json'

// Why a captured follower can or cannot be bought back right now (Tower). Mirrors the engine's
// PayRansom: only on the owner's own action, once a turn, for 3 points.
const make = ({ actionPlayer = 0, ransomPaid = false, points = 5, session = 's1', mySession = 's1', history = 1 } = {}) => {
  const state = {
    action: actionPlayer === null ? null : { player: actionPlayer },
    flags: ransomPaid ? { ransomPaid: true } : {},
    history: new Array(history).fill({}),
    players: [{ points, sessionId: session }, { points: 10, sessionId: 'other' }]
  }
  const rootState = { networking: { sessionId: mySession } }
  const g = {}
  g.ransomStatus = getters.ransomStatus(state, g, rootState)
  g.canPayRansom = getters.canPayRansom(state, g, rootState)
  return g
}

describe('ransomStatus', () => {
  it('can buy back on the owner\'s own action with 3+ points', () => {
    expect(make({ points: 3 }).ransomStatus(0)).toBe('can')
    expect(make({ points: 3 }).canPayRansom(0)).toBe(true)
  })

  it('not enough points (fewer than 3)', () => {
    expect(make({ points: 2 }).ransomStatus(0)).toBe('not-enough-points')
    expect(make({ points: 2 }).canPayRansom(0)).toBe(false)
  })

  it('already bought one back this turn', () => {
    expect(make({ ransomPaid: true }).ransomStatus(0)).toBe('already-paid')
  })

  it('not their action: someone else\'s turn, no action, another window\'s seat, or no history yet', () => {
    expect(make({ actionPlayer: 1 }).ransomStatus(0)).toBe('not-their-action')
    expect(make({ actionPlayer: null }).ransomStatus(0)).toBe('not-their-action')
    expect(make({ mySession: 's2' }).ransomStatus(0)).toBe('not-their-action')
    expect(make({ history: 0 }).ransomStatus(0)).toBe('not-their-action')
  })

  it('every status has an English tooltip', () => {
    for (const k of ['can', 'not-enough-points', 'already-paid', 'not-their-action']) {
      expect(typeof en.game.ransom[k], k).toBe('string')
    }
  })
})
