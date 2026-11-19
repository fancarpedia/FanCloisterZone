import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(dir, 'FinalStats.vue'), 'utf8')

describe('final stats', () => {
  it('has a points row for every category it shows', () => {
    // the categories list renders `s.points[c.name].some(...)` — a category without a points
    // row crashes the whole final screen (it did for 'kingdom')
    const block = src.slice(src.indexOf('const CATEGORIES = ['), src.indexOf(']', src.indexOf('const CATEGORIES = [')))
    const names = [...block.matchAll(/name: '([^']+)'/g)].map(m => m[1])
    expect(names).toContain('kingdom')
    for (const name of names) {
      expect(src, name).toContain(`'${name}': (new Array(this.players.length)).fill(0)`)
    }
  })
})
