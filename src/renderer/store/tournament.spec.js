import { describe, it, expect } from 'vitest'

import { mutations, tournamentMode } from '@/store/index'

// Tournament mode (game option puristTiles): no farm / feature hints, no potential final score
const state = puristTiles => ({
  showGameFarmHints: false,
  showGameFeatureHints: false,
  showPotentialScore: false,
  game: { setup: { options: { puristTiles } } }
})

describe('tournament mode', () => {
  it('is the puristTiles game option', () => {
    expect(tournamentMode(state(true))).toBe(true)
    expect(tournamentMode(state(false))).toBe(false)
    expect(tournamentMode({ game: { setup: null } })).toBe(false)
  })

  it('the hint and potential-score toggles do nothing', () => {
    const st = state(true)
    mutations.toggleGameFarmHints(st)
    mutations.toggleGameFeatureHints(st)
    mutations.togglePotentialScore(st)
    expect([st.showGameFarmHints, st.showGameFeatureHints, st.showPotentialScore]).toEqual([false, false, false])
  })

  it('a normal game toggles them as before', () => {
    const st = state(false)
    mutations.toggleGameFarmHints(st)
    mutations.toggleGameFeatureHints(st)
    mutations.togglePotentialScore(st)
    expect([st.showGameFarmHints, st.showGameFeatureHints, st.showPotentialScore]).toEqual([true, true, true])
  })

  it('opening a tournament game switches aids left on from an earlier game off', () => {
    const st = { ...state(true), showGameFarmHints: true, showGameFeatureHints: true, showPotentialScore: true }
    mutations.tournamentAidsOff(st)
    expect([st.showGameFarmHints, st.showGameFeatureHints, st.showPotentialScore]).toEqual([false, false, false])
  })
})
