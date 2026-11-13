// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'

import { isAutoDarkActive, markAutoDark } from './auto-dark'

// jsdom does not paint, so getComputedStyle is stubbed with what a browser would report for the
// probe's `background: Canvas`: white on a normal page, dark under forced darkening.
const canvas = bg => vi.spyOn(window, 'getComputedStyle').mockReturnValue({ backgroundColor: bg })

describe('auto dark detection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.classList.remove('auto-dark')
  })

  it('is off on a normal page (white canvas)', () => {
    canvas('rgb(255, 255, 255)')
    expect(isAutoDarkActive()).toBe(false)
  })

  it('is on when the browser force-darkens the page', () => {
    canvas('rgb(18, 18, 18)')
    expect(isAutoDarkActive()).toBe(true)
  })

  it('removes its probe element again', () => {
    canvas('rgb(255, 255, 255)')
    const before = document.body.children.length
    isAutoDarkActive()
    expect(document.body.children.length).toBe(before)
  })

  it('treats an unreadable colour as off', () => {
    canvas('')
    expect(isAutoDarkActive()).toBe(false)
  })

  it('markAutoDark puts / removes the auto-dark class on <html>', () => {
    canvas('rgb(10, 10, 10)')
    expect(markAutoDark()).toBe(true)
    expect(document.documentElement.classList.contains('auto-dark')).toBe(true)
    vi.restoreAllMocks()
    canvas('rgb(255, 255, 255)')
    expect(markAutoDark()).toBe(false)
    expect(document.documentElement.classList.contains('auto-dark')).toBe(false)
  })
})

describe('player colours under auto dark mode (player-colors.scss)', () => {
  const fs = require('fs')
  const path = require('path')
  const sass = require('sass')
  const file = path.join(__dirname, '../assets/styles/player-colors.scss')
  const css = sass.renderSync({ data: '$small-screen-max-width: 960px;\n' + fs.readFileSync(file, 'utf8') }).css.toString()

  it('keeps every player colour on the meeples (not the inactive grey ones)', () => {
    for (let i = 0; i < 9; i++) {
      expect(css).toContain(`html.auto-dark .color-${i}.meeple:not(.inactive), html.auto-dark .color-${i} .meeple:not(.inactive)`)
    }
  })

  it('keeps the player-colour surfaces (history turn strip, fills) in the exact colour', () => {
    for (let i = 0; i < 9; i++) {
      expect(css).toContain(`html.auto-dark .color-${i}.color-bg, html.auto-dark .color-${i}.color-bg-important`)
      expect(css).toContain(`html.auto-dark .color-${i}.color-fill`)
    }
    expect(css).toMatch(/html\.auto-dark \.color-2\.color-bg[^{]*\{\s*color-scheme: only light;\s*background: #ffed00 !important;/)
  })

  it('opts the meeples out of the browser darkening, board meeples keep a black outline', () => {
    expect(css).toMatch(/html\.auto-dark svg\.meeple, html\.auto-dark #meeple-layer, html\.auto-dark #meeple-layer-bridges \{\s*color-scheme: only light;/)
    expect(css).toMatch(/html\.auto-dark #meeple-layer use\.meeple, html\.auto-dark #meeple-layer-bridges use\.meeple \{\s*stroke: black;/)
  })

  it('keeps black text on the light colours’ scoring bullets', () => {
    for (const i of [2, 4, 7]) expect(css).toContain(`html.auto-dark .color-${i}.points`)
    expect(css).not.toContain('html.auto-dark .color-0.points')
  })
})

describe('bridges and tower pieces under auto dark mode', () => {
  const fs = require('fs')
  const path = require('path')
  const sass = require('sass')
  const css = sass.renderSync({ data: '$small-screen-max-width: 960px;\n' + fs.readFileSync(path.join(__dirname, '../assets/styles/player-colors.scss'), 'utf8') }).css.toString()
  const read = f => fs.readFileSync(path.join(__dirname, '../components/game', f), 'utf8')

  it('opts the board layers, token images and action items out of the browser darkening', () => {
    expect(css).toContain('html.auto-dark #bridge-layer, html.auto-dark #tower-layer, html.auto-dark .token-image, html.auto-dark svg.bridge-item, html.auto-dark .tower-piece-item {\n  color-scheme: only light;')
  })

  it('the action items carry the classes the rule targets', () => {
    expect(read('actions/items/BridgeItem.vue')).toContain('<svg class="bridge-item">')
    expect(read('actions/items/TowerPieceItem.vue')).toContain('class="tower-piece-item"')
    expect(read('layers/BridgeLayer.vue')).toContain('<g id="bridge-layer">')
    expect(read('layers/TowerLayer.vue')).toContain('<g id="tower-layer">')
  })
})
