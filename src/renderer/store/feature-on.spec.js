import { describe, it, expect } from 'vitest'

import { getters } from '@/store/game'

// Position + location is NOT a unique key for a feature: several inner features share location
// "I" on one tile. TO/L carries both a Tower and a Monastery there, so a castle fed by that
// monastery highlighted the tower instead - the lookup returned whichever came first. Pointers
// carry the feature type; it has to be used.
const TOWER_TILE = [-1, 0]

const state = {
  features: [
    // deliberately BEFORE the monastery, which is what made the old lookup pick it
    { type: 'Tower', places: [[...TOWER_TILE, 'I']] },
    { type: 'Monastery', places: [[...TOWER_TILE, 'I']] },
    { type: 'Road', places: [[1, 0, 'W'], [2, 0, 'E']] },
    { type: 'Field', places: [[1, 0, 'EL.WR']] }
  ]
}
const featureOn = getters.featureOn(state)

describe('featureOn with two features at the same place', () => {
  it('picks the monastery when the pointer says Monastery', () => {
    expect(featureOn({ position: TOWER_TILE, location: 'I', feature: 'Monastery' }).type).toBe('Monastery')
  })

  it('picks the tower when the pointer says Tower', () => {
    expect(featureOn({ position: TOWER_TILE, location: 'I', feature: 'Tower' }).type).toBe('Tower')
  })

  it('falls back to the first match when the pointer names no type', () => {
    // every caller that passes a bare position/location keeps working
    expect(featureOn({ position: TOWER_TILE, location: 'I' }).type).toBe('Tower')
  })

  it('falls back rather than returning nothing when the type does not match', () => {
    // better a near miss than an empty highlight
    expect(featureOn({ position: TOWER_TILE, location: 'I', feature: 'Garden' }).type).toBe('Tower')
  })
})

describe('featureOn elsewhere is unchanged', () => {
  it('resolves a road from one of its places', () => {
    const road = featureOn({ position: [1, 0], location: 'W', feature: 'Road' })
    expect(road.type).toBe('Road')
    expect(road.places).toHaveLength(2)
  })

  it('still maps AS_ABBOT onto the inner location', () => {
    expect(featureOn({ position: TOWER_TILE, location: 'AS_ABBOT', feature: 'Monastery' }).type).toBe('Monastery')
  })

  it('returns undefined for a place no feature occupies', () => {
    expect(featureOn({ position: [9, 9], location: 'N', feature: 'City' })).toBeUndefined()
  })
})

describe('the castle highlight this fixes', () => {
  it('resolves both halves of a castle pointer to the right features', () => {
    const ptr = {
      featurePointer: { position: [0, -1], location: 'S', feature: 'Castle' },
      source: { position: TOWER_TILE, location: 'I', feature: 'Monastery' }
    }
    const withCastle = {
      features: [{ type: 'Castle', places: [[0, -1, 'S']] }, ...state.features]
    }
    const lookup = getters.featureOn(withCastle)
    expect(lookup(ptr.featurePointer).type).toBe('Castle')
    expect(lookup(ptr.source).type).toBe('Monastery')
  })
})
