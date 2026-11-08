import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { getters } from '@/store/game'

// A castle's scoring pointer now names the feature its points came from:
//   { featurePointer: <castle>, source: <road/city/castle> }
// Hovering the bullet must highlight BOTH. There is no component-test harness here, so the
// branch is pinned at source level and the lookup it depends on is exercised directly.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const src = fs.readFileSync(path.join(DIR, 'PointsEvent.vue'), 'utf8').split(CR).join('')

describe('the PointsEvent hover branch', () => {
  it('recognises a pointer that carries a source', () => {
    expect(src).toContain('} else if (ptr.source) {')
  })

  it('highlights the castle and the source together', () => {
    expect(src).toContain('this.showFeatures(this.featureOn(ptr.featurePointer), this.featureOn(ptr.source))')
  })

  it('is checked before the bare-position branch, which would not match this shape', () => {
    // {featurePointer, source} has no top-level position, so a later branch would fall through
    // to featureOn(ptr) and find nothing
    expect(src.indexOf('ptr.source')).toBeLessThan(src.indexOf('ptr.position && !ptr.location'))
  })

  it('keeps the single-feature case working through the same helper', () => {
    expect(src).toMatch(/showFeature \(feature\) \{\s*this\.showFeatures\(feature\)/)
  })

  it('skips features it cannot resolve instead of throwing', () => {
    // a pointer can outlive the feature it names
    expect(src).toContain('features.filter(Boolean)')
  })
})

describe('featureOn, which both halves of the highlight rely on', () => {
  const state = {
    features: [
      { type: 'Castle', places: [[0, -1, 'S'], [0, -1, 'N']] },
      { type: 'Road', places: [[1, 0, 'W'], [2, 0, 'E']] }
    ]
  }
  const featureOn = getters.featureOn(state)

  it('resolves the castle from its pointer', () => {
    expect(featureOn({ position: [0, -1], location: 'S' }).type).toBe('Castle')
  })

  it('resolves the source road from a single one of its places', () => {
    // the engine ships ONE pointer into the source; the whole road must come back
    const road = featureOn({ position: [1, 0], location: 'W' })
    expect(road.type).toBe('Road')
    expect(road.places).toHaveLength(2)
  })

  it('returns undefined for a place no feature occupies', () => {
    expect(featureOn({ position: [9, 9], location: 'N' })).toBeUndefined()
  })
})
