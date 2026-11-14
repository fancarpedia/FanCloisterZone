import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(dir, 'DiscardedTileNotice.vue'), 'utf8')

// the pure helper, evaluated on its own (vitest here has no .vue loader)
const start = src.indexOf('export const newlyDiscarded')
const body = src.slice(start, src.indexOf('\n}\n', start) + 2).replace('export const newlyDiscarded =', 'return')
// eslint-disable-next-line no-new-func
const newlyDiscarded = new Function(body)()

describe('players are told when a drawn tile is discarded', () => {
  it('shows the tiles newly discarded in play', () => {
    expect(newlyDiscarded(['BA/C'], [])).toEqual(['BA/C'])
    expect(newlyDiscarded(['BA/C', 'BA/R', 'BA/F'], ['BA/C'])).toEqual(['BA/R', 'BA/F'])
  })

  it('stays quiet when a game is loaded / started, on an undo, or when nothing changed', () => {
    expect(newlyDiscarded(['BA/C'], null)).toEqual([])
    expect(newlyDiscarded([], ['BA/C'])).toEqual([])
    expect(newlyDiscarded(['BA/C'], ['BA/C'])).toEqual([])
  })

  it('is part of the game screen, with the tile and a translated message', () => {
    expect(fs.readFileSync(path.join(dir, '../../pages/game.vue'), 'utf8')).toContain('<DiscardedTileNotice />')
    expect(src).toContain("$tc('game.action.tile-discarded-notice-plural', tiles.length)")
    const en = JSON.parse(fs.readFileSync(path.join(dir, '../../locales/en.json'), 'utf8'))
    // the plural contract: nplurals + 1 forms (slot 0 unused)
    expect(en.game.action['tile-discarded-notice-plural'].split(' | ')).toHaveLength(3)
  })
})

describe('the notice size', () => {
  it('large on wide screens, smaller on small ones, below the action panel', () => {
    expect(src).toContain('return this.$vuetify.breakpoint.width <= 960 ? 112 : 168')
    expect(src).toContain(':size="tileSize"')
    expect(src).toContain('top: calc(var(--action-panel-height, 84px) + 8px)')
    const small = src.slice(src.indexOf('@media (max-width: $small-screen-max-width)'))
    expect(small).toContain('min-width: 0')
    expect(small).toContain('font-size: 19px')
  })
})

describe('the notice on dark screens', () => {
  it('is light grey with dark text in the dark theme', () => {
    expect(src).toMatch(/#app\.theme--dark \.discarded-tile-notice ::v-deep \.v-snack__wrapper\n\s+background-color: #e0e0e0 !important\n\s+color: #212121 !important/)
  })

  it('and keeps that look under a browser auto dark mode', () => {
    const scss = fs.readFileSync(path.join(dir, '../../assets/styles/player-colors.scss'), 'utf8')
    const block = scss.slice(scss.indexOf('.discarded-tile-notice .v-snack__wrapper {'))
    expect(block).toMatch(/color-scheme: only light;\s+background-color: #e0e0e0 !important;\s+color: #212121 !important;/)
  })
})

describe('the notice layout', () => {
  it('puts the tile(s) above the text', () => {
    expect(src).toMatch(/<div class="notice-tiles">[\s\S]*<\/div>\n\s+<span class="notice-text">/)
    expect(src).toMatch(/\.notice-body\n\s+display: flex\n\s+flex-direction: column/)
  })
})

describe('the close button', () => {
  it('sits in the top-right corner', () => {
    expect(src).toMatch(/\.v-snack__action\n\s+position: absolute\n\s+top: 4px\n\s+right: 4px/)
  })
})
