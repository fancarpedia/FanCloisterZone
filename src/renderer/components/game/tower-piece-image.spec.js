import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('a placed tower piece in the placement panel', () => {
  const panel = read('PlacementPanel.vue')

  it('uses the action panel artwork per kind', () => {
    expect(panel).toContain("TOWER_PIECE: require('~/assets/figures/tower.png')")
    expect(panel).toContain("BLACK_TOWER_PIECE: require('~/assets/figures/black_tower.png')")
    expect(panel).toContain("WHITE_TOWER_PIECE: require('~/assets/figures/white_tower.png')")
    expect(panel).toMatch(/<img v-else-if="towerPieceImage" :src="towerPieceImage" class="tower-piece-image">\n\s+<TokenImage v-else-if="expr.token"/)
  })

  it('everywhere else (history, supply) keeps the tower icon', () => {
    const token = read('TokenImage.vue')
    expect(token).toContain("TOWER_PIECE: { tag: 'svg', src: TOKENS_SVG + '#tower'")
    expect(token).toContain("WHITE_TOWER_PIECE: { tag: 'svg', src: TOKENS_SVG + '#white-tower'")
  })
})
