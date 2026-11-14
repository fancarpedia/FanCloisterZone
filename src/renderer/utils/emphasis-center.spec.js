import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { emphasisCenter, emphasisPositions, offsetsCentering } from './emphasis-center'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('emphasisCenter', () => {
  it('is the middle of a single tile', () => {
    expect(emphasisCenter({ type: 'tile', position: [2, -1] })).toEqual({ x: 2.5, y: -0.5 })
    expect(emphasisCenter({ type: 'meeple', position: [0, 0], feature: 'City', location: 'N' })).toEqual({ x: 0.5, y: 0.5 })
  })

  it('is the middle of the bounding box of several tiles', () => {
    expect(emphasisCenter({ type: 'tiles', positions: [[0, 0], [2, 2]] })).toEqual({ x: 1.5, y: 1.5 })
    expect(emphasisCenter({ type: 'feature', places: [{ tile: { position: [0, 0] } }, { tile: { position: [1, 0] } }] })).toEqual({ x: 1, y: 0.5 })
  })

  it('takes the extra spots and the range frame in', () => {
    expect(emphasisPositions({ type: 'tile', position: [0, 0], extraTiles: [[3, 0]], extraPoints: [{ position: [0, 3] }], frame: [1, 1] }))
      .toEqual([[0, 0], [0, 3], [3, 0], [1, 1]])
  })

  it('is null without a spot on the board', () => {
    expect(emphasisCenter(null)).toBe(null)
    expect(emphasisCenter({ type: 'points', points: [] })).toBe(null)
  })
})

describe('offsetsCentering', () => {
  it('puts the board point at the target, unrotated', () => {
    expect(offsetsCentering({ center: { x: 1, y: 2 }, target: { x: 500, y: 400 }, zoom: 0.5, rotate: 0, baseSize: 100 }))
      .toEqual({ offsetX: 450, offsetY: 300 })
  })

  it('follows the board rotation', () => {
    const o = offsetsCentering({ center: { x: 1, y: 0 }, target: { x: 500, y: 400 }, zoom: 1, rotate: 90, baseSize: 100 })
    // a point 100px right of the origin lands 100px BELOW it after a quarter turn
    expect(o.offsetX).toBeCloseTo(500)
    expect(o.offsetY).toBeCloseTo(300)
  })
})

describe('hovering the history moves the board', () => {
  it('the history reports the hover, the board slides there and back', () => {
    const events = read('../components/game/PlayEvents.vue')
    expect(events).toContain('@mouseenter="setHistoryHover(true)"')
    expect(events).toContain('@mouseleave="setHistoryHover(false)"')
    const board = read('../components/game/Board.vue')
    expect(board).toContain('return emphasisCenter(this.layers.EmphasizeLayer?.emphasis)')
    expect(board).toContain("'$store.state.board.historyHover' (value) {")
    expect(board).toContain('this.animatePan(back)')
    // grabbing the board keeps it where the player leaves it
    expect(board).toMatch(/onPointerDown \(ev\) \{[\s\S]{0,300}this\.panBeforeHover = null/)
  })
})
