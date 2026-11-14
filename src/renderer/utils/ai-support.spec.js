import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { aiSupport, isAiExpansion, isAiElement } from './ai-support'
import { Expansion } from '@/models/expansions'
import { Rule } from '@/models/rules'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

// $tiles stand-in: each set id names its expansion
const tiles = { getExpansions: sets => Object.fromEntries(Object.entries(sets).filter(([, n]) => n).map(([id, n]) => [id, n])) }

describe('what the AI plays', () => {
  it('the tile sets the former AI mode listed', () => {
    for (const name of ['BASIC', 'START', 'INNS_AND_CATHEDRALS', 'TRADERS_AND_BUILDERS', 'RIVER', 'CULT', 'WATCHTOWERS']) {
      expect(isAiExpansion(name)).toBe(true)
    }
    for (const name of ['WINTER', 'TOWER', 'ABBEY_AND_MAYOR', 'PRINCESS_AND_DRAGON', 'HILLS_AND_SHEEP']) {
      expect(isAiExpansion(name)).toBe(false)
    }
    expect(isAiExpansion(Expansion.BASIC)).toBe(true)
  })

  it('a fan expansion only when it says so', () => {
    expect(isAiExpansion({ name: 'FAN_X', fan: true, ai: true })).toBe(true)
    expect(isAiExpansion({ name: 'FAN_Y', fan: true, ai: false })).toBe(false)
  })

  it('elements: the basic figures yes, the ones the AI mode hid no', () => {
    for (const id of ['small-follower', 'big-follower', 'builder', 'pig', 'traders', 'farmers', 'cathedral', 'inn']) {
      expect(isAiElement(id)).toBe(true)
    }
    for (const id of ['abbot', 'tower', 'dragon', 'fairy', 'wagon', 'keep-building', 'pre-draw']) {
      expect(isAiElement(id)).toBe(false)
    }
  })
})

describe('aiSupport(setup)', () => {
  it('a base game with Inns & Cathedrals is fine', () => {
    const r = aiSupport({ sets: { BASIC: 1, INNS_AND_CATHEDRALS: 1 }, elements: { 'small-follower': 7, 'big-follower': 1, farmers: true }, rules: {} }, tiles)
    expect(r).toEqual({ ok: true, expansions: [], elements: [], rules: [] })
  })

  it('names a tile set the AI does not play', () => {
    const r = aiSupport({ sets: { BASIC: 1, TOWER: 1 }, elements: {}, rules: {} }, tiles)
    expect(r.ok).toBe(false)
    expect(r.expansions).toEqual(['TOWER'])
  })

  it('names an element switched on that the AI does not play, but not one an AI set brings in', () => {
    const r = aiSupport({ sets: { BASIC: 1 }, elements: { abbot: 1, dragon: false, wagon: 0 }, rules: {} }, tiles)
    expect(r.elements).toEqual(['abbot'])
    // Cult brings its shrines: fine, it is the expansion the AI plays
    const shrine = Expansion.CULT && [...(Expansion.CULT.implies || []), ...(Expansion.CULT.enforces || [])].find(id => id === 'shrine')
    if (shrine) {
      expect(aiSupport({ sets: { BASIC: 1, CULT: 1 }, elements: { shrine: true }, rules: {} }, tiles).elements).toEqual([])
    }
  })

  it('names a variant changed from its default', () => {
    const rule = Rule.KEEP_MONASTERIES
    const other = rule.default === true ? false : (rule.default === false ? true : 'something-else')
    const r = aiSupport({ sets: { BASIC: 1 }, elements: {}, rules: { [rule.id]: other } }, tiles)
    expect(r.rules).toEqual([rule.id])
    expect(aiSupport({ sets: { BASIC: 1 }, elements: {}, rules: { [rule.id]: rule.default } }, tiles).ok).toBe(true)
  })
})

describe('where it shows', () => {
  it('no "new game against AI" buttons any more', () => {
    expect(read('../pages/online.vue')).not.toContain('new-game-against-ai')
    expect(read('../pages/index.vue')).not.toContain('new-game-against-ai')
  })

  it('the setup header warns, expansion and element boxes carry the AI badge', () => {
    expect(read('../pages/game-setup.vue')).toContain('<AiSupportBadge />')
    for (const f of ['ExpansionBox.vue', 'GameElementBox.vue', 'GameMechanicsBox.vue']) {
      expect(read('../components/game-setup/' + f)).toContain('<div v-if="aiPlayable" class="ai-badge"')
    }
  })
})
