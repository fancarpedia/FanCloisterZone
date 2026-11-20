import { describe, it, expect, vi } from 'vitest'

// tiles.js imports Electron at module level; only the pure getSupply / getAllowedColorSlots matter here
vi.mock('electron', () => ({ ipcRenderer: { invoke: vi.fn(), on: vi.fn() } }))

const { Tiles } = await import('./tiles.js')

// the two methods read only `this.sets` and `this.tiles`
const tilesWith = (sets, tiles) => Object.assign(Object.create(Tiles.prototype), { sets, tiles })

const kingdoms = tilesWith(
  { kingdoms: { supplyTiles: { 'x/PalaceRed': 1, 'x/PalaceBlue': 1 }, element: 'kingdom-palace' } },
  { 'x/PalaceRed': { kingdomPalace: 'red' }, 'x/PalaceBlue': { kingdomPalace: 'blue' } }
)

describe('getAllowedColorSlots — player colors a game can seat', () => {
  it('any color (null) while the per-color supply element is off', () => {
    expect(kingdoms.getAllowedColorSlots({})).toBe(null)
    expect(kingdoms.getAllowedColorSlots({ 'kingdom-palace': false })).toBe(null)
  })

  it('only the colors that have a Kingdom Palace when it is on', () => {
    const allowed = kingdoms.getAllowedColorSlots({ 'kingdom-palace': 1 })
    expect([...allowed].sort()).toEqual([0, 1]) // red = slot 0, blue = slot 1
  })

  it('a supply element without colors (the abbey) restricts nothing', () => {
    const abbey = tilesWith(
      { abbey: { supplyTiles: { 'AM/A': 1 }, element: 'abbey' } },
      { 'AM/A': {} }
    )
    expect(abbey.getAllowedColorSlots({ abbey: true })).toBe(null)
  })
})
