import { describe, it, expect, vi } from 'vitest'

// tiles.js imports Electron at module level; only the pure getFeatureTiles matters here
vi.mock('electron', () => ({ ipcRenderer: { invoke: vi.fn(), on: vi.fn() } }))

const { Tiles } = await import('./tiles.js')

// a base set (edition-specific keys) and Inns & Cathedrals; the inn is an attribute of a road
// (road[inn]) — tileFeatures holds what the selectors matched when the XML was parsed
const tiles = Object.assign(Object.create(Tiles.prototype), {
  sets: {
    'basic:1': { expansion: 'BASIC', tiles: { 'BA/Rr': 8, 'BA/C': 1 } },
    'basic:2': { expansion: 'BASIC', tiles: { 'BA/Rr': 9, 'BA/C': 1 } },
    'inns-and-cathedrals': { expansion: 'INNS_AND_CATHEDRALS', tiles: { 'IC/RrI': 2, 'IC/CC': 1 } }
  },
  tiles: { 'BA/Rr': {}, 'BA/C': {}, 'IC/RrI': {}, 'IC/CC': {} },
  tileFeatures: {
    'BA/Rr': new Set(['road', 'farmers']),
    'BA/C': new Set(['city']),
    'IC/RrI': new Set(['road', 'inn', 'farmers']),
    'IC/CC': new Set(['city', 'cathedral'])
  }
})

describe('getFeatureTiles — the Rules tab info dialog', () => {
  it('an attribute of a road (the inn): its tiles, chosen count of all tile sets\' count', () => {
    const r = tiles.getFeatureTiles('inn', { basic: 1 }, null, 1)
    expect(r).toEqual({ tiles: [{ id: 'IC/RrI', count: 0, total: 2, expansion: 'INNS_AND_CATHEDRALS' }], count: 0, total: 2 })
    expect(tiles.getFeatureTiles('inn', { basic: 1, 'inns-and-cathedrals': 1 }, null, 1).count).toBe(2)
  })

  it('a base feature over all expansions, by edition, chosen tiles first', () => {
    const r = tiles.getFeatureTiles('road', { 'inns-and-cathedrals': 1 }, null, 2)
    expect(r.tiles.map(t => t.id)).toEqual(['IC/RrI', 'BA/Rr'])
    expect(r.total).toBe(9 + 2) // the 2nd edition base set only
    expect(r.count).toBe(2)
  })

  it('per-tile overrides change the chosen count', () => {
    expect(tiles.getFeatureTiles('road', { basic: 1 }, { 'BA/Rr': 3 }, 1).count).toBe(3)
    expect(tiles.getFeatureTiles('road', { basic: 1 }, { 'BA/Rr': 0 }, 1).count).toBe(0)
  })
})
