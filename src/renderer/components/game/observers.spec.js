import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { mutations } from '../../store/game'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('who is watching the game', () => {
  it('keeps the list sent for this game, ignores another game’s', () => {
    const state = { id: 'g1', observers: [] }
    mutations.observers(state, { gameId: 'g1', observers: [{ clientId: 'C', name: 'Carl', country: 'SK' }] })
    expect(state.observers).toEqual([{ clientId: 'C', name: 'Carl', country: 'SK' }])
    mutations.observers(state, { gameId: 'g2', observers: [] })
    expect(state.observers).toHaveLength(1)
    mutations.observers(state, { gameId: 'g1', observers: null })
    expect(state.observers).toEqual([])
  })

  it('arrives as GAME_OBSERVERS and shows under the player panels', () => {
    expect(read('../../store/networking.js')).toContain("commit('game/observers', payload, { root: true })")
    expect(read('../../pages/game.vue')).toContain('<ObserversPanel />')
    const panel = read('ObserversPanel.vue')
    expect(panel).toContain('v-if="observers.length"')
    expect(panel).toContain('<CountryFlag :country="o.country" />')
  })
})
