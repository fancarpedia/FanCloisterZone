import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Courier points (name "courier.<feature>") now carry the followers of the scored feature, like a
// regular score event. Hovering the bullet highlights the feature and pulses only the meeples that
// have left the board since - the ones still standing there are visible already. No component
// harness here, so the branch is pinned at source level (as castle-score-source.spec.js does).
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const src = fs.readFileSync(path.join(DIR, 'PointsEvent.vue'), 'utf8').split(CR).join('')
const branch = src.slice(src.indexOf("if (name.startsWith('courier.')) {"))
const branchBody = branch.slice(0, branch.indexOf('return\n') + 'return'.length)

describe('the PointsEvent courier hover branch', () => {
  it('exists', () => {
    expect(src).toContain("if (name.startsWith('courier.')) {")
  })

  it('runs before the generic branch that draws every listed meeple', () => {
    expect(src.indexOf("name.startsWith('courier.')")).toBeLessThan(src.indexOf('if (meeples && meeples.length) {'))
  })

  it('highlights the scored feature', () => {
    expect(branchBody).toContain('this.showFeature(feature, extraPoints)')
  })

  it('pulses only the meeples no longer on the board', () => {
    expect(branchBody).toContain('(meeples || []).filter(h => this.isMeepleRemoved(h))')
    expect(branchBody).toContain("layer: 'EventMeeplesLayer'")
    expect(branchBody).toContain('props: { meeples: removed, winners: [] }')
  })

  it('still shows the points breakdown and stops there', () => {
    expect(branchBody).toContain("this.$store.commit('board/pointsExpression', points)")
    expect(branchBody.trim().endsWith('return')).toBe(true)
  })
})
