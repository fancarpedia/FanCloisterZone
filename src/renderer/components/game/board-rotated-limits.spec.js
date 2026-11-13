import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Board pan limits follow the board's rotation: after a 90° turn a row of tiles runs vertically on
// screen, and the limits must let it scroll along that side. At 0° they are the old limits exactly.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(DIR, 'Board.vue'), 'utf8').split(String.fromCharCode(13)).join('')
const method = name => {
  const start = src.indexOf('    ' + name + ' () {')
  return src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
}
// eslint-disable-next-line no-new-func
const screenExtent = (bounds, rotate, tileSize) => new Function(method('screenExtent')).call({ bounds, rotate, tileSize })

const near = (a, b) => Math.abs(a - b) < 1e-6

describe('board pan limits with rotation', () => {
  const row = { x: 0, y: 0, width: 4, height: 1 } // four tiles in a row
  const ts = 100

  it('at 0° is the unrotated box (the old limits)', () => {
    const e = screenExtent(row, 0, ts)
    expect([e.left, e.right, e.top, e.bottom]).toEqual([0, 400, 0, 100])
  })

  it('after 90° the row is 4 tiles tall and 1 wide on screen', () => {
    const e = screenExtent(row, 90, ts)
    expect(near(e.right - e.left, 100)).toBe(true)
    expect(near(e.bottom - e.top, 400)).toBe(true)
  })

  it('180° and 270° keep the size, flipped around the origin', () => {
    const e180 = screenExtent(row, 180, ts)
    expect(near(e180.left, -400) && near(e180.right, 0)).toBe(true)
    const e270 = screenExtent(row, 270, ts)
    expect(near(e270.bottom - e270.top, 400) && near(e270.right - e270.left, 100)).toBe(true)
  })

  it('adjustAfterMove clamps with the rotated extent', () => {
    const adjust = method('adjustAfterMove')
    expect(adjust).toContain('const { left, right, top, bottom } = this.screenExtent()')
    expect(adjust).toContain('const maxX = parseInt(-(left + edge) + (80 + adjustedWidth / 3 * 2))')
    expect(adjust).toContain('const minY = parseInt(-(bottom - edge) + 84 + adjustedHeight / 3)')
  })
})
