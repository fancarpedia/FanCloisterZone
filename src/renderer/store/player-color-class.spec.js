import { describe, it, expect } from 'vitest'
import { getters } from '@/store/game'

// The number in a player colour class is the player's SLOT (the colour they picked), not their
// seat index. Those coincide only when everyone happens to take colours in seat order, which is
// why using the seat index "works" in testing and then shows the wrong colour in a real game.
//
// Two places turn a player into a background class, and they must agree:
//   PlayerPanel.vue  (right sidebar)        colorCssClass(index).replaceAll('color', 'panel-color')
//   ActionPanel.vue  (small-screen tint)    the same, for the active player
const panelColorClass = (state, player) =>
  getters.colorCssClass(state).call(null, player).replaceAll('color', 'panel-color')

// seat 0 took colour 4 (orange), seat 1 took colour 2 (yellow), seat 2 took colour 0 (red)
const state = { players: [{ slot: 4 }, { slot: 2 }, { slot: 0 }] }

describe('player colour classes', () => {
  it('maps a seat to the colour that seat actually picked', () => {
    expect(getters.colorCssClass(state)(0)).toBe('color color-4')
    expect(getters.colorCssClass(state)(1)).toBe('color color-2')
    expect(getters.colorCssClass(state)(2)).toBe('color color-0')
  })

  it('builds the panel class from the colour, not the seat index', () => {
    expect(panelColorClass(state, 0)).toBe('panel-color panel-color-4')
    expect(panelColorClass(state, 1)).toBe('panel-color panel-color-2')
    expect(panelColorClass(state, 2)).toBe('panel-color panel-color-0')
  })

  it('would be wrong if the seat index were used directly — the bug this guards', () => {
    // what ActionPanel did at first: `panel-color-${action.player}`
    for (const seat of [0, 1, 2]) {
      expect(panelColorClass(state, seat)).not.toBe(`panel-color panel-color-${seat}`)
    }
  })

  it('coincides with the seat index only when colours were taken in order', () => {
    const inOrder = { players: [{ slot: 0 }, { slot: 1 }, { slot: 2 }] }
    expect(panelColorClass(inOrder, 1)).toBe('panel-color panel-color-1')
  })

  it('covers every colour slot the palette defines', () => {
    const all = { players: Array.from({ length: 9 }, (_, i) => ({ slot: i })) }
    for (let i = 0; i < 9; i++) {
      expect(panelColorClass(all, i)).toBe(`panel-color panel-color-${i}`)
    }
  })
})
