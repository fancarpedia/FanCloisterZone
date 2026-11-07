import { describe, it, expect } from 'vitest'
import { state, mutations } from '@/store/index'

// The supply toggle in the aside (game.vue) depends on exactly two things in the root store:
// the initial state and the mutation. Asserting them here means a dead toggle can be narrowed
// to the view layer in one test run instead of by trial and error in the running app.
describe('player supply toggle', () => {
  it('starts collapsed', () => {
    expect(state().showPlayerSupply).toBe(false)
  })

  it('has the mutation the button commits', () => {
    expect(typeof mutations.togglePlayerSupply).toBe('function')
  })

  it('flips the flag both ways', () => {
    const s = state()
    mutations.togglePlayerSupply(s)
    expect(s.showPlayerSupply).toBe(true)
    mutations.togglePlayerSupply(s)
    expect(s.showPlayerSupply).toBe(false)
  })

  it('does not disturb the neighbouring toggles', () => {
    const s = state()
    const history = s.showGameHistory
    const farm = s.showGameFarmHints
    mutations.togglePlayerSupply(s)
    expect(s.showGameHistory).toBe(history)
    expect(s.showGameFarmHints).toBe(farm)
  })
})
