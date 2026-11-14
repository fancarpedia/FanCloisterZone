import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')
const src = read('MeepleReturnedEvent.vue')

const start = src.indexOf('    onMouseEnter () {')
const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
// eslint-disable-next-line no-new-func
const run = new Function('withCause', body)
const onMouseEnter = function () { return run.call(this, e => e) }

describe('a follower captured by a tower, in the history', () => {
  it('is drawn behind prison bars, not crossed out', () => {
    expect(src).toContain('<svg v-if="captured" class="prison-bars"')
    expect(src).toContain('<v-icon v-else>fas fa-slash</v-icon>')
    expect(src).toContain("return this.ev.type === 'meeple-captured'")
    expect(read('PlayEvent.vue')).toContain("'meeple-captured': MeepleReturnedEvent")
  })

  it('hovered: the panel says captured, by the tower of the player whose turn it was', () => {
    const commit = vi.fn()
    const ev = { type: 'meeple-captured', meeple: 'SmallFollower', player: 1, from: { position: [0, 0], feature: 'City', location: 'N' } }
    onMouseEnter.call({ captured: true, ev, player: 0, $store: { commit, dispatch: vi.fn() } })
    expect(commit).toHaveBeenCalledWith('board/placementPanel', {
      kind: 'captured', meeple: 'SmallFollower', player: 1, actor: 0, source: 'TOWER'
    })
  })

  it('the panel knows the tower as a source, with its artwork, and has the title', () => {
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain("TOWER: 'game.element.tower'")
    expect(panel).toContain("TOWER: require('~/assets/figures/tower.png')")
    const en = JSON.parse(read('../../../locales/en.json'))
    expect(en.game.placement.title.captured).toContain('{figure}')
  })
})

describe('the capturing tower in the panel', () => {
  it('is as large as a placed tower piece there', () => {
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain(":class=\"causeVisual.towerPiece ? 'tower-piece-image' : 'source-image'\"")
    expect(panel).toContain("towerPiece: this.expr.source === 'TOWER'")
  })
})

describe('the captured follower in the panel', () => {
  it('is behind prison bars', () => {
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain(`<svg v-if="expr.kind === 'captured' && expr.meeple" class="prison-bars"`)
    expect(panel).toMatch(/\.subject\n\s+position: relative[\s\S]*?svg\.prison-bars\n\s+position: absolute/)
  })
})
