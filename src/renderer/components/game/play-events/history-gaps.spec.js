import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('the gaps between history events belong to the events', () => {
  const ev = read('PlayEvent.vue')

  it('a transparent border instead of a margin, the background stopping at it', () => {
    const block = ev.slice(ev.indexOf('\n.play-event\n'), ev.indexOf('\n.score-event\n'))
    expect(block).not.toContain('margin-right: 1px')
    expect(block).toContain('border-right: 1px solid transparent')
    expect(block).toContain('border-bottom: 1px solid transparent')
    expect(block).toContain('background-clip: padding-box')
  })

  it('the event inside reaches over the border, so the pointer never leaves it in a gap', () => {
    expect(ev).toMatch(/> \*\n\s+box-sizing: content-box\n\s+margin: 0 -1px -1px 0\n\s+padding: 0 1px 1px 0/)
    expect(ev).toMatch(/\.score-event\n\s+border-bottom: 1px solid transparent[\s\S]*?margin-bottom: -1px\n\s+padding-bottom: 1px/)
  })

  it('scoring bullets too, their colour kept to the bullet', () => {
    const points = read('PointsEvent.vue')
    expect(points).toMatch(/padding-bottom: 1px\n\s+margin-bottom: -1px\n\s+background-clip: content-box/)
  })

  it('no timing in the action panel', () => {
    const panel = read('../ActionPanel.vue')
    expect(panel).not.toContain('HISTORY_PANEL_GRACE')
    expect(panel).not.toContain('livePanels')
  })
})
