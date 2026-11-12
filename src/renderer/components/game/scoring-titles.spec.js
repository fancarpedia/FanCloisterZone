import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import en from '@/locales/en.json'

// Every locale key the scoring views name must exist, or the raw key is shown instead of text
// (the final-scoring Courier row once read "game.figure.courier").
const DIR = path.dirname(fileURLToPath(import.meta.url))
const get = key => key.split('.').reduce((o, k) => (o ? o[k] : undefined), en)
const keysIn = (file, re) => [...fs.readFileSync(path.join(DIR, file), 'utf8').matchAll(re)].map(m => m[1])

describe('scoring titles resolve to real locale keys', () => {
  it('FinalStats category titles', () => {
    const keys = keysIn('FinalStats.vue', /title: '([^']+)'/g)
    expect(keys.length).toBeGreaterThan(20)
    expect(keys.filter(k => typeof get(k) !== 'string')).toEqual([])
  })

  it('PointsExpression title / subtitle mappings', () => {
    const keys = keysIn('PointsExpression.vue', /: '((?:game|core-messages)\.[^']+)'/g)
    expect(keys.length).toBeGreaterThan(20)
    expect(keys.filter(k => typeof get(k) !== 'string')).toEqual([])
  })
})
