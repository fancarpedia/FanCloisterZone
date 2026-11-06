import { describe, it, expect } from 'vitest'

import { barnOwnersByPlace, barnOwnersOf, effectiveOwnersOf, isHintedField } from '@/models/farm-hints'

// Shapes come from the engine's StateGsonBuilder:
//   features[]       { type, places: [[x, y, location], ...], owners: [playerIdx], cities }
//   deployedMeeples[] { type, player, position: [x, y], feature, location }
const field = (places, owners = [], cities = 0) => ({ type: 'Field', places, owners, cities })
const barn = (player, [x, y], location) =>
  ({ type: 'Barn', player, position: [x, y], feature: 'Field', location })
const follower = (player, [x, y], location) =>
  ({ type: 'SmallFollower', player, position: [x, y], feature: 'Field', location })

describe('farm hints', () => {
  describe('barnOwnersByPlace', () => {
    it('indexes barns by place', () => {
      expect(barnOwnersByPlace([barn(2, [1, -1], 'NL')]))
        .toEqual({ '1,-1,NL': [2] })
    })

    it('ignores everything that is not a barn', () => {
      expect(barnOwnersByPlace([follower(0, [0, 0], 'NL'), barn(1, [0, 0], 'SR')]))
        .toEqual({ '0,0,SR': [1] })
    })

    it('keeps several barns on one place without duplicating a player', () => {
      const barns = barnOwnersByPlace([barn(1, [0, 0], 'NL'), barn(3, [0, 0], 'NL'), barn(1, [0, 0], 'NL')])
      expect(barns['0,0,NL']).toEqual([1, 3])
    })

    it('survives no meeples at all', () => {
      expect(barnOwnersByPlace(undefined)).toEqual({})
      expect(barnOwnersByPlace([])).toEqual({})
    })
  })

  describe('the reported bug: a field holding only a barn', () => {
    // Placing a barn scores and returns every farmer on the field, so the engine reports
    // owners: [] — the field used to vanish from the overlay.
    const f = field([[0, 0, 'NL'], [0, 1, 'SR']], [], 0)
    const barns = barnOwnersByPlace([barn(2, [0, 1], 'SR')])

    it('is hinted', () => {
      expect(isHintedField(f, barns)).toBe(true)
    })

    it('is hinted in the barn owner\'s colour', () => {
      expect(effectiveOwnersOf(f, barns)).toEqual([2])
    })

    it('would NOT be hinted without the barn — the regression this guards', () => {
      expect(isHintedField(f, {})).toBe(false)
      expect(effectiveOwnersOf(f, {})).toEqual([])
    })
  })

  describe('effectiveOwnersOf', () => {
    it('keeps the engine\'s follower owners when there is no barn', () => {
      expect(effectiveOwnersOf(field([[0, 0, 'NL']], [1]), {})).toEqual([1])
    })

    it('unions followers and barns, so a contested field shows both', () => {
      const f = field([[0, 0, 'NL']], [1])
      const barns = barnOwnersByPlace([barn(3, [0, 0], 'NL')])
      expect(effectiveOwnersOf(f, barns).sort()).toEqual([1, 3])
    })

    it('does not list the same player twice when they own both', () => {
      const f = field([[0, 0, 'NL']], [1])
      const barns = barnOwnersByPlace([barn(1, [0, 0], 'NL')])
      expect(effectiveOwnersOf(f, barns)).toEqual([1])
    })

    it('matches a barn on ANY place of a multi-tile field', () => {
      const f = field([[0, 0, 'NL'], [1, 0, 'WR'], [2, 0, 'SL']])
      const barns = barnOwnersByPlace([barn(0, [2, 0], 'SL')])
      expect(barnOwnersOf(f, barns)).toEqual([0])
    })

    it('ignores a barn whose location does not match the field place', () => {
      const f = field([[0, 0, 'NL']])
      const barns = barnOwnersByPlace([barn(0, [0, 0], 'SR')])
      expect(barnOwnersOf(f, barns)).toEqual([])
    })
  })

  describe('isHintedField', () => {
    it('skips features that are not fields', () => {
      expect(isHintedField({ type: 'City', places: [[0, 0, 'N']], owners: [1] }, {})).toBe(false)
    })

    it('hints an owned field however small', () => {
      expect(isHintedField(field([[0, 0, 'NL']], [0]), {})).toBe(true)
    })

    it('hints an unclaimed field only when it adjoins a city and spans places', () => {
      expect(isHintedField(field([[0, 0, 'NL'], [0, 1, 'SR']], [], 1), {})).toBe(true)
      expect(isHintedField(field([[0, 0, 'NL']], [], 1), {})).toBe(false) // single sliver
      expect(isHintedField(field([[0, 0, 'NL'], [0, 1, 'SR']], [], 0), {})).toBe(false) // no city
    })
  })
})
