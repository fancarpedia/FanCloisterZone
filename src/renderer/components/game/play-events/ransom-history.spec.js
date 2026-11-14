import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

const points = read('PointsEvent.vue')
const start = points.indexOf('    withRansom (points) {')
const body = points.slice(points.indexOf('{', start) + 1, points.indexOf('\n    },', start))
// eslint-disable-next-line no-new-func
const withRansom = (ctx, p) => new Function('points', body).call(ctx, p)

const ransom = { type: 'ransom-paid', follower: 'SmallFollower', prisoner: 1, jailer: 0 }

describe('a ransom in the history', () => {
  it('is not shown as an event of its own (its scoring bullets already are), but kept for the turn', () => {
    const events = read('../PlayEvents.vue')
    expect(events).toMatch(/if \(ev\.type === 'ransom-paid'\) \{[\s\S]{0,400}turnEvents\.push\(ev\)\n\s+return/)
  })

  const item = { name: 'meeples', count: 1, points: -3 }

  it('the payer’s -3: its follower item becomes their own freed follower', () => {
    const r = withRansom({ siblings: [ransom] }, { name: 'ransompaid.payment', player: 1, points: -3, items: [item] })
    expect(r.items).toEqual([{ ...item, meeple: 'SmallFollower', player: 1 }])
  })

  it('the jailer’s +3: the follower of the player who paid', () => {
    const r = withRansom({ siblings: [ransom] }, { name: 'ransompaid.income', player: 0, points: 3, items: [item] })
    expect(r.items).toEqual([{ ...item, meeple: 'SmallFollower', player: 1 }])
  })

  it('other points are untouched', () => {
    const p = { name: 'city', player: 0 }
    expect(withRansom({ siblings: [ransom] }, p)).toBe(p)
  })

  it('the expression draws that follower, in its owner’s colour, instead of a plain one', () => {
    const item = read('../ExpressionItem.vue')
    expect(item).toContain('<svg class="meeple" :class="meepleColorClass" :width="40" :height="40">')
    expect(item).toContain("return this.item.meeple ? kebabCase(this.item.meeple) : 'small-follower'")
    expect(read('../PointsExpression.vue')).not.toContain('ransom-for')
  })
})

describe('the freed follower keeps the payer’s colour', () => {
  it('is not greyed by the expression item style', () => {
    const item = read('../ExpressionItem.vue')
    expect(item).toContain('svg.meeple:not(.color), svg.artwork-element, svg.exp-symbol')
    // colorCssClass gives "color color-N", so a coloured follower carries .color
    expect(fs.readFileSync(path.join(dir, '../../../store/game.js'), 'utf8')).toContain("colorCssClass: state => player => 'color color-' + state.players[player].slot")
  })
})
