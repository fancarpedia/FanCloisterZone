import { describe, it, expect } from 'vitest'

import { aiExpansionLevel, isAiExpansion, meetsAiVersion } from './ai-support'

// The four AI stages of an expansion (utils/ai-support.js aiExpansionLevel), shown by the expansion
// box's badge: a robot, + a blue "i" ('allowed'), dimmed + an amber "!" ('implied'), nothing ('none').
const fan = (opts) => ({ name: 'FAN_X', fan: true, ai: true, enforces: [], implies: [], allowedElements: [], ...opts })
const core = (opts) => ({ name: 'CORE_X', enforces: [], implies: [], impliesAllowed: [], ...opts })

describe('AI stages of an expansion', () => {
  it('1 — every element is one the AI plays: AI', () => {
    expect(aiExpansionLevel(fan({ allowedElements: ['inn'] }))).toEqual({ level: 'ai', elements: [] }) // Butterfly tiles
    expect(aiExpansionLevel(fan({ allowedElements: ['well'] }))).toEqual({ level: 'ai', elements: [] }) // Farmers Heaven
    expect(aiExpansionLevel(core({ implies: ['builder', 'pig', 'traders'], impliesAllowed: ['pig-herd'] })).level).toBe('ai')
  })

  it('2 — an enforced element the AI does not play: never AI', () => {
    expect(aiExpansionLevel(fan({ enforces: ['dragon'] })).level).toBe('none')
    expect(aiExpansionLevel(core({ enforces: ['corn-circle'] })).level).toBe('none')
    expect(isAiExpansion(core({ enforces: ['corn-circle'] }))).toBe(false)
  })

  it('2 — an implied element the setup cannot switch off counts as enforced', () => {
    expect(aiExpansionLevel(core({ implies: ['no-such-game-element'] })).level).toBe('none')
  })

  it('2 — a fan add-on whose minimumVersionForAI is not met: never AI', () => {
    expect(aiExpansionLevel(fan({ ai: false, allowedElements: ['inn'] })).level).toBe('none')
  })

  it('3 — only an allowed element the AI does not play: AI unless it is switched on (The City Gates)', () => {
    expect(aiExpansionLevel(fan({ allowedElements: ['families', 'tunnel', 'inn'] }))).toEqual({ level: 'allowed', elements: ['families', 'tunnel'] })
    expect(isAiExpansion(fan({ allowedElements: ['tunnel'] }))).toBe(true)
  })

  it('4 — an implied element the AI does not play: AI only once it is switched off (Tower)', () => {
    expect(aiExpansionLevel(core({ implies: ['tower'] }))).toEqual({ level: 'implied', elements: ['tower'] })
    // implied beats allowed: the "!" is what the player must act on first
    expect(aiExpansionLevel(core({ implies: ['tower'], impliesAllowed: ['tunnel'] })).level).toBe('implied')
    expect(isAiExpansion(core({ implies: ['tower'] }))).toBe(true)
  })
})

describe('a fan add-on\'s minimumVersionForAI', () => {
  const APP = '7.2.0-alpha.3'

  it('no tag (or an empty one) → nothing to meet', () => {
    expect(meetsAiVersion(null, APP)).toBe(true)
    expect(meetsAiVersion('', APP)).toBe(true)
  })

  it('with a tag, the app version must reach it', () => {
    expect(meetsAiVersion('6.1.0-alpha.42', APP)).toBe(true)
    expect(meetsAiVersion('7.2.0', APP)).toBe(true)
    expect(meetsAiVersion('7.3.0', APP)).toBe(false)
    // the tilemaker's "never" for a tile feature the AI cannot handle
    expect(meetsAiVersion('9999.0.0', APP)).toBe(false)
  })
})
