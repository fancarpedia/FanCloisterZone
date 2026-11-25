import { describe, it, expect } from 'vitest'

import { computeClock, remainingTimeSec, getters } from '@/store/game'

// The first player whose time runs out loses on time: remembered, and placed last in the result
// even if later turn bonuses bring the clock back above zero or they have the most points.
const timer = { initial: 10, turn: 5 }

describe('computeClock — the first timeout in a replayed game', () => {
  it('finds the first player who ran out of time, in move order', () => {
    // player 0 plays 12 s (10 + 5 = 15 allowed → ok), player 1 then plays 20 s (15 allowed → out),
    // player 0 later also runs out — but player 1 was first
    const messages = [
      { clock: 12000, player: 1 },
      { clock: 32000, player: 0 },
      { clock: 60000, player: 1 }
    ]
    const { clocks, timedOut, timedOutSec } = computeClock(2, messages, timer)
    expect(clocks).toEqual([40000, 20000])
    expect(timedOut).toBe(1)
    // 10 s + 5 s for its turn − 20 s used: 5 s over when it happened
    expect(timedOutSec).toBe(-5)
  })

  it('ignores going over by less than 4 seconds', () => {
    // player 1: 10 + 5 = 15 s allowed — 18 s used is 3 s over (not counted), 19 s is 4 s over (counted)
    expect(computeClock(2, [{ clock: 1000, player: 1 }, { clock: 19000, player: 0 }], timer).timedOut).toBe(null)
    const { timedOut, timedOutSec } = computeClock(2, [{ clock: 1000, player: 1 }, { clock: 20000, player: 0 }], timer)
    expect(timedOut).toBe(1)
    expect(timedOutSec).toBe(-4)
  })

  it('finds none within the time, and none without a timer', () => {
    const messages = [{ clock: 5000, player: 1 }, { clock: 9000, player: 0 }]
    expect(computeClock(2, messages, timer).timedOut).toBe(null)
    expect(computeClock(2, [{ clock: 999000, player: 1 }], null).timedOut).toBe(null)
  })
})

describe('ranks — lost on time', () => {
  const state = timedOut => ({
    timedOut,
    players: [{ points: 10 }, { points: 50 }, { points: 30 }]
  })

  it('places the timed-out player last, whatever their points', () => {
    const ranks = getters.ranks(state(1))
    expect(ranks.map(r => r.players.map(p => p.index))).toEqual([[2], [0], [1]])
    expect(ranks[ranks.length - 1]).toMatchObject({ rank: 3, timedOut: true })
    expect(ranks[0].rank).toBe(1)
  })

  it('ranks by points as before when nobody timed out', () => {
    expect(getters.ranks(state(null)).map(r => r.players.map(p => p.index))).toEqual([[1], [2], [0]])
  })

  it('remainingTimeSec matches the clock display', () => {
    expect(remainingTimeSec(timer, 2, 21000)).toBe(-1)
  })
})
