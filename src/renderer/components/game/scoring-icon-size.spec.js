import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// A tile-based scoring icon renders as <svg class="tile-img">, and other components style that
// class for their own, far larger tile previews. `.action-panel .tile-img` is 84px, and because
// the scoring breakdown is drawn INSIDE the action bar it caught the little icons too: a road
// came out 72px beside a 46px monastery. A class rule beats the svg's width/height attributes,
// so the size has to be stated inline.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').split(CR).join('')
const icon = read('./ScoringIcon.vue')

// ScoringIcon's own normalisation, as the component defines it
const SCALE = { tile: 0.82, img: 1.15 }
const sizeFor = (kind, size) => Math.round(size * (SCALE[kind] || 1))

describe('the normalisation ScoringIcon applies', () => {
  it('draws a full-tile icon smaller, because it fills its box', () => {
    expect(sizeFor('tile', 40)).toBe(33)
  })

  it('draws cropped art larger, because it has padding around it', () => {
    expect(sizeFor('img', 40)).toBe(46)
  })

  it('keeps road and city no bigger than the monastery in a castle breakdown', () => {
    // road and city are tiles, the monastery is cropped art
    const monastery = sizeFor('img', 40)
    expect(sizeFor('tile', 40)).toBeLessThanOrEqual(monastery)
  })

  it('scales with the requested size', () => {
    expect(sizeFor('tile', 36)).toBe(30)
    expect(sizeFor('img', 36)).toBe(41)
  })
})

describe('how the size is enforced', () => {
  it('states it inline, where a class rule cannot override it', () => {
    expect(icon).toContain('boxStyle ()')
    expect(icon).toMatch(/width: `\$\{this\.iconSize\}px`/)
    expect(icon).toMatch(/height: `\$\{this\.iconSize\}px`/)
  })

  it('applies it to the tile icon, the one wearing the contested class', () => {
    expect(icon).toMatch(/StandaloneTileImage[^>]*:style="boxStyle"/)
  })

  it('also clears the transform those rules add', () => {
    // `.action-panel .tile-img` carries scale(1.1) alongside its width
    expect(icon).toContain("transform: 'none'")
  })
})
