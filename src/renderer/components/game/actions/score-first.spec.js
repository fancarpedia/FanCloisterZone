import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { ENGINE_MESSAGES } from '@/constants/messages'

// SCORE_FIRST: when two or more completed features sit beside one castle, the castle takes the
// points of whichever is scored first, and the turn player picks it on the board. The engine sets
// the phase to ScoringPhase and offers a "ScoreFirst" item; ActionPanel resolves the component by
// name ("ScoringPhase" + "Action"). There is no component-test harness here, so the wiring is
// pinned at source level.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').split(CR).join('')

const component = read('./ScoringPhaseAction.vue')
const panel = read('../ActionPanel.vue')
const en = JSON.parse(fs.readFileSync(path.join(DIR, '../../../locales/en.json'), 'utf8'))

describe('the message reaches the engine', () => {
  it('is on the allowlist networking.js filters by', () => {
    // the trap ROTATE_TILE fell into: a type missing here has its reply silently dropped
    expect(ENGINE_MESSAGES.has('SCORE_FIRST')).toBe(true)
  })
})

describe('ActionPanel shows it', () => {
  it('imports the component', () => {
    expect(panel).toContain("import ScoringPhaseAction from '@/components/game/actions/ScoringPhaseAction.vue'")
  })

  it('registers it under the name the phase resolves to', () => {
    const components = panel.slice(panel.indexOf('components: {'), panel.indexOf('},', panel.indexOf('components: {')))
    expect(components).toMatch(/\bScoringPhaseAction,/)
  })
})

describe('the picker', () => {
  it('reads its options from the ScoreFirst item', () => {
    expect(component).toContain("this.action.items.find(i => i.type === 'ScoreFirst')")
  })

  it('highlights the contested features on the board', () => {
    expect(component).toContain("['FeatureSelectLayer', {")
  })

  it('draws feature areas, not a meeple marker', () => {
    // FeatureSelectLayer draws a meeple marker only when one is passed
    const layer = component.slice(component.indexOf("['FeatureSelectLayer', {"), component.indexOf('}]]'))
    expect(layer).not.toContain('meeple')
  })

  it('is clickable only for the turn player', () => {
    expect(component).toMatch(/active \(\) \{\s*return this\.local/)
  })

  it('sends the chosen feature as SCORE_FIRST', () => {
    expect(component).toContain("type: 'SCORE_FIRST'")
    expect(component).toContain('payload: { pointer }')
  })

  it('stops listening when it goes away', () => {
    expect(component).toContain("this.$root.$off('feature.select', this.onSelect)")
  })
})

describe('the text', () => {
  it('asks the turn player', () => {
    expect(en.game.action['score-first-choose']).toBe('Choose which feature to score first')
  })

  it('tells everyone else what is happening', () => {
    expect(en.game.action['score-first-player-must-choose']).toBe('Player must choose which feature to score first')
  })

  it('uses both, depending on whose choice it is', () => {
    expect(component).toContain("local ? $t('game.action.score-first-choose') : $t('game.action.score-first-player-must-choose')")
  })
})
