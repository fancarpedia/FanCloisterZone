import { describe, it, expect } from 'vitest'
import { reverseSeatOrder, claimableRematchSlots } from '@/store/rematch'

// Regression coverage for the "Rematch" button (GameResultPanel.vue). A finished game's
// Rematch is supposed to:
//   1. reverse the player order (whoever went second now goes first),
//   2. do so deterministically — the same finished game always produces the same new seating,
//   3. and, online, reserve the same seats for the same players so a stranger cannot join in
//      instead of one of the original participants.
// These three properties are exactly what regressed in practice, so each gets its own test.

describe('reverseSeatOrder', () => {
  it('swaps the order of a 2-player game', () => {
    const slots = [
      { number: 0, name: 'Alice', order: 0 },
      { number: 1, name: 'Bob', order: 1 }
    ]

    const [alice, bob] = reverseSeatOrder(slots)

    expect(alice.order).toBe(1)
    expect(bob.order).toBe(0)
  })

  it('fully reverses the turn order for more than 2 players', () => {
    const slots = [
      { number: 0, name: 'Alice', order: 0 },
      { number: 1, name: 'Bob', order: 1 },
      { number: 2, name: 'Carol', order: 2 }
    ]

    const [alice, bob, carol] = reverseSeatOrder(slots)

    // Carol went last, so she now goes first, and so on down the line.
    expect(alice.order).toBe(2)
    expect(bob.order).toBe(1)
    expect(carol.order).toBe(0)
  })

  it('is deterministic: rematching the same game twice yields the same seating', () => {
    const slots = [
      { number: 0, name: 'Alice', order: 0 },
      { number: 1, name: 'Bob', order: 1 },
      { number: 2, name: 'Carol', order: 2 },
      { number: 3, name: 'Dave', order: 3 }
    ]

    const first = reverseSeatOrder(slots).map(s => s.order)
    const second = reverseSeatOrder(slots).map(s => s.order)

    expect(second).toEqual(first)
  })

  it('clears stale online identifiers so they cannot leak into the new game', () => {
    const slots = [
      { number: 0, name: 'Alice', order: 0, gameId: 'old-game', sessionId: 'old-session', clientId: 'client-a' }
    ]

    const [alice] = reverseSeatOrder(slots)

    expect(alice.gameId).toBeNull()
    expect(alice.sessionId).toBeNull()
    // clientId is unrelated to the finished game and must survive the rematch untouched.
    expect(alice.clientId).toBe('client-a')
  })

  it('leaves unseated (empty) slots alone', () => {
    const slots = [
      { number: 0, name: 'Alice', order: 0 },
      { number: 1, name: null, order: undefined }
    ]

    const result = reverseSeatOrder(slots)

    expect(result).toHaveLength(2)
    expect(result[1].order).toBeUndefined()
  })
})

describe('claimableRematchSlots', () => {
  const rematchSlots = [
    { number: 1, name: 'Bob' }, // now seat 1, going first
    { number: 0, name: 'Alice' } // now seat 0, going second
  ]

  it('claims every seat when the freshly created game is still empty', () => {
    const gameSlots = [
      { number: 0, clientId: null },
      { number: 1, clientId: null }
    ]

    expect(claimableRematchSlots(rematchSlots, gameSlots)).toEqual(rematchSlots)
  })

  it('does not hand a seat to the original player if a stranger already took it', () => {
    const gameSlots = [
      { number: 0, clientId: null },
      { number: 1, clientId: 'someone-else' } // a third client joined before the rematch could claim it
    ]

    const claimable = claimableRematchSlots(rematchSlots, gameSlots)

    expect(claimable).toEqual([{ number: 0, name: 'Alice' }])
  })

  it('claims nothing once every seat is already taken', () => {
    const gameSlots = [
      { number: 0, clientId: 'someone-else' },
      { number: 1, clientId: 'someone-else' }
    ]

    expect(claimableRematchSlots(rematchSlots, gameSlots)).toEqual([])
  })
})
