import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ActionPhaseAction.vue'), 'utf8')

// pull a method body out of the component and run it against a plain `this`
const method = name => {
  const start = src.indexOf('\n    ' + name + ' (')
  const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
  // eslint-disable-next-line no-new-func
  return (ctx, small = true) => new Function('isSmallScreen', body).call(ctx, () => small)
}
const update = method('updateScrollHints')
const row = (scrollLeft, clientWidth = 300, scrollWidth = 900) => ({ scrollLeft, clientWidth, scrollWidth })

describe('arrows for action items scrolled out of view', () => {
  it('at the start: only the right arrow', () => {
    const ctx = { $refs: { itemsRow: row(0) }, hiddenLeft: false, hiddenRight: false }
    update(ctx)
    expect([ctx.hiddenLeft, ctx.hiddenRight]).toEqual([false, true])
  })

  it('in the middle: both', () => {
    const ctx = { $refs: { itemsRow: row(300) }, hiddenLeft: false, hiddenRight: false }
    update(ctx)
    expect([ctx.hiddenLeft, ctx.hiddenRight]).toEqual([true, true])
  })

  it('at the end: only the left arrow', () => {
    const ctx = { $refs: { itemsRow: row(600) }, hiddenLeft: false, hiddenRight: false }
    update(ctx)
    expect([ctx.hiddenLeft, ctx.hiddenRight]).toEqual([true, false])
  })

  it('none when everything fits, or on a wide screen (items scaled to fit there)', () => {
    const fits = { $refs: { itemsRow: row(0, 300, 300) }, hiddenLeft: true, hiddenRight: true }
    update(fits)
    expect([fits.hiddenLeft, fits.hiddenRight]).toEqual([false, false])
    const wide = { $refs: { itemsRow: row(0) }, hiddenLeft: true, hiddenRight: true }
    update(wide, false)
    expect([wide.hiddenLeft, wide.hiddenRight]).toEqual([false, false])
  })

  it('kept up to date on scroll and on resize; tapping one scrolls that way', () => {
    expect(src).toContain('@scroll.passive="updateScrollHints"')
    expect(src).toMatch(/this\.measureLines\(\)\n\s+this\.updateScrollHints\(\)/)
    expect(src).toContain('@click.stop="scrollItems(-1)"')
    expect(src).toContain('@click.stop="scrollItems(1)"')
  })
})
