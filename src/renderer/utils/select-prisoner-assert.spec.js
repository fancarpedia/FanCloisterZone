import { describe, it, expect } from 'vitest'

import { verifyScenario } from './testing'

const state = {
  action: {
    player: 1,
    items: [{ type: 'SelectPrisonerToExchange', options: [{ type: 'Mayor', id: '1.mayor.1' }, { type: 'SmallFollower', id: '1.small.1' }] }]
  },
  players: [{ name: 'Betty', points: 0 }, { name: 'John', points: 0 }]
}
const check = assertion => verifyScenario(state, { description: 't', assertions: [assertion] }).assertions[0]

describe('SelectPrisonerToExchange options assertion', () => {
  it('passes for exactly the offered followers, in any order', () => {
    expect(check('SelectPrisonerToExchange options: {1.small.1,SmallFollower}, {1.mayor.1,Mayor}').result).toBe(true)
  })

  it('fails for a missing, extra or wrongly typed follower, and says what was offered', () => {
    const r = check('SelectPrisonerToExchange options: {1.small.1,SmallFollower}')
    expect(r.result).toBe(false)
    expect(r.error).toContain('{1.mayor.1,Mayor}')
    expect(check('SelectPrisonerToExchange options: {1.mayor.1,SmallFollower}, {1.small.1,SmallFollower}').result).toBe(false)
  })
})
