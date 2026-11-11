import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { wholeFeaturePlaces } from './whole-feature'
import { getters } from '@/store/game'

// The score-first picker highlighted only the part of each feature on the tile its option points
// at, so a 3-tile road looked like a 1-tile one. In wholeFeature mode every place of the feature is
// drawn. The board is the one from the engine's score-first test: a crossroads at (1,0) completing
// a 3-tile road and a 2-tile road at once.
const state = {
  features: [
    { type: 'Road', places: [[-1, 0, 'E'], [0, 0, 'WE'], [1, 0, 'W']] }, // main road, 3 tiles
    { type: 'Road', places: [[1, -1, 'S'], [1, 0, 'N']] }, // short road, 2 tiles
    { type: 'Monastery', places: [[1, -1, 'I']] },
    { type: 'Tower', places: [[1, -1, 'I']] } // shares the monastery's place, as on TO/L
  ]
}
const featureOn = getters.featureOn(state)

const MAIN = { position: [1, 0], location: 'W', feature: 'Road' }
const SHORT = { position: [1, 0], location: 'N', feature: 'Road' }

describe('wholeFeaturePlaces', () => {
  it('expands an option into every place of its feature', () => {
    expect(wholeFeaturePlaces(MAIN, featureOn)).toEqual([
      { position: [-1, 0], location: 'E' },
      { position: [0, 0], location: 'WE' },
      { position: [1, 0], location: 'W' }
    ])
  })

  it('keeps two options on the same tile apart', () => {
    // both roads have a segment on (1,0); each must expand to its own road only
    expect(wholeFeaturePlaces(SHORT, featureOn)).toEqual([
      { position: [1, -1], location: 'S' },
      { position: [1, 0], location: 'N' }
    ])
  })

  it('picks the feature of the right type when two share a place', () => {
    const tower = { position: [1, -1], location: 'I', feature: 'Tower' }
    const monastery = { position: [1, -1], location: 'I', feature: 'Monastery' }
    expect(wholeFeaturePlaces(tower, featureOn)).toEqual([{ position: [1, -1], location: 'I' }])
    expect(featureOn(monastery).type).toBe('Monastery')
    expect(featureOn(tower).type).toBe('Tower')
  })

  it('falls back to the option itself when the feature cannot be resolved', () => {
    const unknown = { position: [9, 9], location: 'N', feature: 'City' }
    expect(wholeFeaturePlaces(unknown, featureOn)).toEqual([{ position: [9, 9], location: 'N' }])
  })

  it('falls back when the feature has no places', () => {
    expect(wholeFeaturePlaces(MAIN, () => ({ type: 'Road', places: [] })))
      .toEqual([{ position: [1, 0], location: 'W' }])
  })
})

// FeatureSelectLayer is a .vue file with no component-test harness here, so its wiring is pinned
// at source level.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').split(CR).join('')
const layer = read('../components/game/layers/FeatureSelectLayer.vue')
const picker = read('../components/game/actions/ScoringPhaseAction.vue')

describe('FeatureSelectLayer in wholeFeature mode', () => {
  it('is opt-in, so meeple placement and the other pickers are unchanged', () => {
    expect(layer).toContain('wholeFeature: { type: Boolean, default: false }')
  })

  it('draws each part at its own place, not at the option', () => {
    expect(layer).toContain(':transform="transformPosition(at || opt.position)"')
  })

  it('makes every part share the option, so hovering one lights the whole feature', () => {
    // hover compares the option object, so all parts must carry the SAME object
    const block = layer.slice(layer.indexOf('if (this.wholeFeature) {'))
    expect(block.slice(0, 900)).toMatch(/optionsWithFeature\.push\(\{\s*option,/)
  })

  it('gives each part its own key', () => {
    expect(layer).toContain(':key="segment || (positionAsKey(opt.position) + opt.feature + opt.location)"')
  })
})

describe('the score-first picker', () => {
  it('asks for whole features', () => {
    expect(picker).toContain('wholeFeature: true')
  })

  it('is the only picker that does', () => {
    for (const f of [
      '../components/game/actions/items/ScoreAcrobatsItem.vue',
      '../components/game/actions/items/MeeplePlacementItem.vue',
      '../components/game/actions/items/NeutralFigureItem.vue',
      '../components/game/actions/CocCountPhaseAction.vue'
    ]) {
      expect(read(f), f).not.toContain('wholeFeature')
    }
  })
})
