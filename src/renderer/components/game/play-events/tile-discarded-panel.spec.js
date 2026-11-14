import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('hovering a discarded tile in the history', () => {
  it('shows it in the action panel with why it was discarded', () => {
    const ev = read('TileDiscardedEvent.vue')
    expect(ev).toContain('@mouseenter="onMouseEnter"')
    expect(ev).toContain("titleKey: 'game.placement.title.discarded'")
    expect(ev).toContain("subtitleKey: 'game.placement.discarded-reason'")
    expect(ev).toContain("this.$store.commit('board/placementPanel', null)")
  })

  it('the panel shows the fixed explanation line', () => {
    expect(read('../PlacementPanel.vue')).toContain('if (this.expr.subtitleKey) return this.$t(this.expr.subtitleKey)')
  })

  it('has its English texts', () => {
    const en = JSON.parse(read('../../../locales/en.json'))
    expect(en.game.placement.title.discarded).toBeTruthy()
    expect(en.game.placement['discarded-reason']).toBeTruthy()
  })
})
