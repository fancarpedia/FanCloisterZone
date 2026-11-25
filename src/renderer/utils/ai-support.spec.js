import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { aiSupport, aiExpansionLevel, isAiExpansion, isAiElement } from './ai-support'
import { Expansion } from '@/models/expansions'
import { Rule } from '@/models/rules'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

// $tiles stand-in: each set id names its expansion
const tiles = { getExpansions: sets => Object.fromEntries(Object.entries(sets).filter(([, n]) => n).map(([id, n]) => [id, n])) }

describe('what the AI plays', () => {
  it('a core expansion by its elements: the former AI mode sets, and Winter (brings no element)', () => {
    for (const name of ['BASIC', 'START', 'INNS_AND_CATHEDRALS', 'TRADERS_AND_BUILDERS', 'RIVER', 'GQ11', 'CULT',
      'WIND_ROSES', 'DARMSTADT', 'LABYRINTH', 'SPIEL_DOCH', 'WINTER']) {
      expect(isAiExpansion(name)).toBe(true)
    }
    // enforcing a mechanic the AI does not play: never
    for (const name of ['CORN_CIRCLES', 'MONASTERIES', 'FLIER']) {
      expect(isAiExpansion(name)).toBe(false)
    }
    // implying one: playable once it is switched off (stage 4)
    for (const name of ['TOWER', 'ABBEY_AND_MAYOR', 'PRINCESS_AND_DRAGON', 'HILLS_AND_SHEEP', 'TUNNEL', 'WATCHTOWERS']) {
      expect(aiExpansionLevel(name).level).toBe('implied')
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

  it('names a tile set the AI never plays (it enforces a mechanic the AI does not play)', () => {
    const r = aiSupport({ sets: { BASIC: 1, CORN_CIRCLES: 1 }, elements: {}, rules: {} }, tiles)
    expect(r.ok).toBe(false)
    expect(r.expansions).toEqual(['CORN_CIRCLES'])
  })

  it('stage 4: the Tower with its tower switched on is not AI-playable — switched off it is', () => {
    const on = aiSupport({ sets: { BASIC: 1, TOWER: 1 }, elements: { tower: 10 }, rules: {} }, tiles)
    expect(on.ok).toBe(false)
    expect(on.expansions).toEqual([])
    expect(on.elements).toEqual(['tower'])
    expect(aiSupport({ sets: { BASIC: 1, TOWER: 1 }, elements: { tower: 0 }, rules: {} }, tiles).ok).toBe(true)
  })

  it('an allowlist: any element switched on that is not listed disables AI — even an unknown one', () => {
    const r = aiSupport({ sets: { BASIC: 1 }, elements: { 'small-follower': 7, 'farmers': true, 'some-addon-thing': 1, 'other-addon-thing': false }, rules: {} }, tiles)
    expect(r.ok).toBe(false)
    expect(r.elements).toEqual(['some-addon-thing'])
    expect(isAiElement('some-addon-thing')).toBe(false)
    expect(read('ai-support.js')).not.toContain('NON_AI_ELEMENT')
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

  it('rules: an allowlist — a listed one at any value is fine, any other one changed disables AI', () => {
    const listed = Rule.TINY_CITY_SCORING
    const changed = listed.default === true ? false : (listed.default === false ? true : 'something-else')
    expect(aiSupport({ sets: { BASIC: 1 }, elements: {}, rules: { [listed.id]: changed } }, tiles).ok).toBe(true)
    expect(read('ai-support.js')).not.toContain('NON_AI_RULE')
  })

  it('an element a set only allows (pig herd, wells stay fine, tunnels do not) decides once switched on', () => {
    expect(aiSupport({ sets: { BASIC: 1, TRADERS_AND_BUILDERS: 1 }, elements: { 'pig-herd': true }, rules: {} }, tiles).ok).toBe(true)
    expect(aiSupport({ sets: { BASIC: 1 }, elements: { well: true }, rules: {} }, tiles).ok).toBe(true)
    expect(aiSupport({ sets: { BASIC: 1 }, elements: { tunnel: true }, rules: {} }, tiles).elements).toEqual(['tunnel'])
    expect(aiSupport({ sets: { BASIC: 1 }, elements: { tunnel: false }, rules: {} }, tiles).ok).toBe(true)
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
    // from the Tiles tab on (no tiles are chosen on the bookmarks / variant tabs)
    expect(read('../pages/game-setup.vue')).toContain('<AiSupportBadge v-if="tab > 1" />')
    for (const f of ['ExpansionBox.vue', 'GameElementBox.vue', 'GameMechanicsBox.vue']) {
      expect(read('../components/game-setup/' + f)).toContain('<div v-if="aiPlayable" class="ai-badge"')
    }
  })
})
