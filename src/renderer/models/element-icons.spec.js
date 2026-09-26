import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'
import { ELEMENT_ICONS, getElementIcon } from '@/models/elements'

// ELEMENT_ICONS is the single source of truth for WHICH image an element draws. It has two
// consumers — GameElementIcon.vue (setup boxes, final stats) and OverviewElementTile.vue (the
// setup summary in the server game list) — and the overview used to carry its own hardcoded
// copy of the list. They drifted: adding the Mini Meeple made it render everywhere except the
// overview, which showed a "+2" quantity badge with no figure at all. These tests guard the
// table itself, so a typo or a half-added element fails here instead of silently drawing
// nothing on one screen.

const RENDERER = join(__dirname, '..')
const MEEPLES_SVG = readFileSync(join(RENDERER, 'assets', 'meeples.svg'), 'utf8')
const TOKENS_SVG = readFileSync(join(RENDERER, 'assets', 'tokens.svg'), 'utf8')

const KINDS = ['meeple', 'token', 'neutral', 'fig', 'tile', 'feature']

const entries = Object.entries(ELEMENT_ICONS)

describe('ELEMENT_ICONS', () => {
  it('gives every entry exactly one icon kind', () => {
    for (const [id, icon] of entries) {
      const kinds = KINDS.filter(k => icon[k] !== undefined)
      expect(kinds, `${id} must declare exactly one of ${KINDS.join('/')}`).toHaveLength(1)
    }
  })

  it('references meeple sprites that exist in assets/meeples.svg', () => {
    for (const [id, icon] of entries.filter(([, i]) => i.meeple)) {
      expect(MEEPLES_SVG, `${id} -> #${icon.meeple}`).toContain(`id="${icon.meeple}"`)
    }
  })

  it('references token sprites that exist in assets/tokens.svg', () => {
    for (const [id, icon] of entries.filter(([, i]) => i.token)) {
      expect(TOKENS_SVG, `${id} -> #${icon.token}`).toContain(`id="${icon.token}"`)
    }
  })

  it('references figure images that exist on disk', () => {
    for (const [id, icon] of entries.filter(([, i]) => i.fig)) {
      const file = join(RENDERER, 'assets', 'figures', icon.fig)
      expect(existsSync(file), `${id} -> assets/figures/${icon.fig}`).toBe(true)
    }
  })

  it('references feature images that exist on disk', () => {
    for (const [id, icon] of entries.filter(([, i]) => i.feature)) {
      const file = join(RENDERER, 'assets', 'features', icon.feature)
      expect(existsSync(file), `${id} -> assets/features/${icon.feature}`).toBe(true)
    }
  })

  // The exact set the game-list overview used to draw from its own hardcoded list. Every one of
  // these must keep resolving, or that screen silently loses a figure again.
  it('still resolves every element the game-list overview draws', () => {
    const viaTable = [
      'small-follower', 'abbot', 'phantom', 'big-follower', 'mini-follower', 'builder', 'pig',
      'mayor', 'wagon', 'barn', 'shepherd', 'ringmaster', 'obelisk', 'windmill',
      'decinsky-sneznik',
      'garden', 'fairy', 'black-fairy', 'dragon', 'count', 'donkey', 'abbey',
      'tower', 'black-tower', 'bridge', 'castle', 'little-buildings', 'king', 'robber',
      'traders', 'gold',
      'inn', 'cathedral', 'princess', 'portal', 'pig-herd', 'vineyard', 'bazaar', 'hill',
      'shrine', 'festival', 'escape', 'robbers-son', 'well', 'marketplace', 'meteorite',
      'fishermen', 'fishhut'
    ]
    for (const id of viaTable) {
      expect(getElementIcon(id), `${id} has no ELEMENT_ICONS entry`).toBeTruthy()
    }
  })

  // These four are drawn by OverviewElementTile's own bespoke branches (a rotated follower, a
  // TokenImage, two glyph tiles), so they deliberately have no table entry. If one ever gains
  // one, the lookup branches run first and the bespoke rendering silently stops being used.
  it('keeps the bespoke overview renderings out of the table', () => {
    for (const id of ['farmers', 'flowers', 'pre-draw', 'keep-building']) {
      expect(getElementIcon(id), `${id} is rendered bespoke, it must not gain a table entry`).toBeNull()
    }
  })
})
