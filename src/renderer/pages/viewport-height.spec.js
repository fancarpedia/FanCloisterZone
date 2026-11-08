import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// A mobile browser measures 100vh against the viewport with the URL bar HIDDEN. While the bar is
// showing, the bottom of a 100vh element is below what the player can see - so the pre-draw hand,
// which is anchored to the bottom of .game-view, scrolled out of reach. `dvh` tracks the visible
// height. The 100vh line stays first as the fallback for browsers without dvh.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const NL = String.fromCharCode(10)
const game = fs.readFileSync(path.join(DIR, 'game.vue'), 'utf8').split(CR).join('')

const ruleBody = (selector, src) => {
  const start = src.indexOf('\n' + selector + '\n')
  if (start < 0) return ''
  // sass block: lines more indented than the selector
  const lines = src.slice(start + 1).split('\n')
  const out = [lines[0]]
  for (const l of lines.slice(1)) {
    if (l.trim() && !l.startsWith(' ')) break
    out.push(l)
  }
  return out.join('\n')
}

describe('the full-height containers track the VISIBLE viewport', () => {
  it.each(['.game-view', '.game-modal'])('%s uses dvh', selector => {
    const body = ruleBody(selector, game)
    expect(body, selector).not.toBe('')
    expect(body).toContain('height: 100dvh')
  })

  it.each(['.game-view', '.game-modal'])('%s keeps 100vh as a fallback, declared first', selector => {
    const body = ruleBody(selector, game)
    const vh = body.indexOf('height: 100vh')
    const dvh = body.indexOf('height: 100dvh')
    expect(vh).toBeGreaterThan(-1)
    // a browser that does not understand dvh keeps the earlier declaration
    expect(vh).toBeLessThan(dvh)
  })
})

// Every full-height container in the app, not just the game view: the same overshoot would push
// the bottom of any of them out of reach on a phone.
describe('every full-height container app-wide', () => {
  const FILES = [
    'game.vue', 'index.vue', 'loading.vue', 'online.vue', 'open-game.vue', 'test-runner.vue',
    '../layouts/default.vue'
  ]

  it.each(FILES)('%s pairs each viewport height with a dvh line', file => {
    const src = fs.readFileSync(path.join(DIR, file), 'utf8').split(CR).join('')
    const lines = src.split(NL)
    const unpaired = []
    lines.forEach((line, i) => {
      const m = line.match(/^(\s*)((?:min-|max-)?height): 100vh\s*$/)
      if (!m) return
      const next = lines[i + 1] || ''
      if (next.trim() !== `${m[2]}: 100dvh`) unpaired.push(line.trim())
    })
    expect(unpaired).toEqual([])
  })

  it('leaves no full-height container behind', () => {
    // guards against a new page being added with a bare 100vh
    const all = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join(NL)
    const vh = (all.match(/(?:min-|max-)?height: 100vh/g) || []).length
    const dvh = (all.match(/(?:min-|max-)?height: 100dvh/g) || []).length
    expect(dvh).toBe(vh)
  })
})

describe('the element whose position depends on it', () => {
  const hand = fs.readFileSync(path.join(DIR, '../components/game/PreDrawHand.vue'), 'utf8').split(CR).join('')

  it('is anchored to the bottom, which is why the container height matters', () => {
    expect(hand).toContain('position: absolute')
    expect(hand).toMatch(/bottom: this\.position\.bottom \+ 'px'/)
  })
})
