import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { pickAutoSlot } from '@/store/networking'

// Create game / Join game: the new player takes a seat right away — the preferred colour when it is
// free, otherwise (taken, or no preference) a random free one.
const slot = (number, extra = {}) => ({ number, clientId: null, sessionId: null, ...extra })
const game = (slots, setup = {}) => ({ slots, setup })
const first = () => 0 // "random" picks the first free seat
const last = () => 0.999 // … or the last

describe('pickAutoSlot', () => {
  it('takes the preferred colour when it is free', () => {
    const g = game([slot(0), slot(1), slot(2)])
    expect(pickAutoSlot(g, 2, 's1', null, first).number).toBe(2)
  })

  it('takes a random free seat when the preferred colour is taken', () => {
    const g = game([slot(0), slot(1, { clientId: 'x', sessionId: 'other' }), slot(2)])
    expect(pickAutoSlot(g, 1, 's1', null, first).number).toBe(0)
    expect(pickAutoSlot(g, 1, 's1', null, last).number).toBe(2)
  })

  it('takes a random free seat with no preferred colour (None)', () => {
    const g = game([slot(0, { clientId: 'x' }), slot(1), slot(2)])
    expect(pickAutoSlot(g, null, 's1', null, first).number).toBe(1)
    expect(pickAutoSlot(g, null, 's1', null, last).number).toBe(2)
  })

  it('takes nothing when this client already sits (re-join), the game is full or capped', () => {
    expect(pickAutoSlot(game([slot(0, { clientId: 'c', sessionId: 's1' }), slot(1)]), 1, 's1', null)).toBe(null)
    expect(pickAutoSlot(game([slot(0, { clientId: 'x' }), slot(1, { clientId: 'y' })]), null, 's1', null)).toBe(null)
    const capped = game([slot(0, { clientId: 'x' }), slot(1), slot(2)], { options: { maxPlayers: 1 } })
    expect(pickAutoSlot(capped, 1, 's1', null)).toBe(null)
  })

  it('only offers colours the setup can seat (Kingdom Palaces)', () => {
    const $tiles = { getAllowedColorSlots: () => new Set([2]) }
    const g = game([slot(0), slot(1), slot(2)])
    expect(pickAutoSlot(g, 0, 's1', $tiles, first).number).toBe(2)
  })
})

// The GAME message is handled by the ConnectionHandler class, not by a store action: `this` there
// has no _vm, so reaching $tiles through this._vm threw (swallowed as "processMessage error") and
// no seat was ever taken. The handler gets $tiles from the connect action instead.
describe('the automatic seat in the GAME handler', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'networking.js'), 'utf8')

  it('reaches the tile sets through the handler, not this._vm', () => {
    expect(src).toContain('pickAutoSlot(payload, rootState.settings.preferredColor, state.sessionId, this.$tiles)')
    expect(src).toContain('new ConnectionHandler(ctx, host, this.$router, $addons, $connection, resolve, $windows, $tiles)')
    expect(src).toContain('this.$tiles = $tiles')
  })
})
