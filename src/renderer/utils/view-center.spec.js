import { describe, it, expect } from 'vitest'

import {
  ACTION_BAR_HEIGHT,
  HISTORY_WIDTH,
  PLAYERS_PANEL_WIDTH,
  centerOf,
  recenterAfterResize
} from './view-center'

// Where a board point lands on screen, given the pan offset and the zoom.
const screenOf = (board, offset, tileSize) => board * tileSize + offset

describe('centerOf', () => {
  it('is not the middle of the element - the panels cover part of it', () => {
    const c = centerOf(1000, 800)
    expect(c.x).not.toBe(500)
    expect(c.y).not.toBe(400)
  })

  it('sits midway between the history strip and the players panel', () => {
    const c = centerOf(1000, 800)
    expect(c.x).toBe(HISTORY_WIDTH + (1000 - PLAYERS_PANEL_WIDTH - HISTORY_WIDTH) / 2)
    expect(c.y).toBe(ACTION_BAR_HEIGHT + (800 - ACTION_BAR_HEIGHT) / 2)
  })
})

describe('recenterAfterResize', () => {
  // the view before the resize: a board point parked exactly in the middle of what is visible
  const before = { width: 1400, height: 900 }
  const tileSize = 120
  const boardX = 3.5
  const boardY = -2.25
  const offsetX = centerOf(before.width, before.height).x - boardX * tileSize
  const offsetY = centerOf(before.width, before.height).y - boardY * tileSize

  const resizeTo = (next, size = tileSize) =>
    recenterAfterResize({ prev: before, next, offsetX, offsetY, tileSize: size })

  const stillCentred = (next, moved, size = tileSize) => {
    const c = centerOf(next.width, next.height)
    expect(screenOf(boardX, moved.offsetX, size)).toBeCloseTo(c.x, 6)
    expect(screenOf(boardY, moved.offsetY, size)).toBeCloseTo(c.y, 6)
  }

  it('keeps that point centred when the window is narrowed', () => {
    const next = { width: 900, height: 900 }
    stillCentred(next, resizeTo(next))
  })

  it('keeps it centred when the window is widened', () => {
    const next = { width: 1920, height: 900 }
    stillCentred(next, resizeTo(next))
  })

  it('keeps it centred when the height changes too', () => {
    const next = { width: 1100, height: 1300 }
    stillCentred(next, resizeTo(next))
  })

  it('keeps it centred at a different zoom', () => {
    // offsets have to be built AT that zoom, or a different board point is the centred one
    const zoom = 45
    const ox = centerOf(before.width, before.height).x - boardX * zoom
    const oy = centerOf(before.width, before.height).y - boardY * zoom
    const next = { width: 800, height: 600 }
    const moved = recenterAfterResize({ prev: before, next, offsetX: ox, offsetY: oy, tileSize: zoom })
    stillCentred(next, moved, zoom)
  })

  it('changes nothing when the size is unchanged', () => {
    const moved = resizeTo(before)
    expect(moved.offsetX).toBeCloseTo(offsetX, 6)
    expect(moved.offsetY).toBeCloseTo(offsetY, 6)
  })

  it('shifts the view by half the change in width', () => {
    // widening by 300 moves the visible middle 150 to the right, so the board goes with it
    const moved = resizeTo({ width: before.width + 300, height: before.height })
    expect(moved.offsetX - offsetX).toBeCloseTo(150, 6)
    expect(moved.offsetY - offsetY).toBeCloseTo(0, 6)
  })

  it('is reversible - resizing back restores the original offsets', () => {
    const next = { width: 700, height: 500 }
    const there = recenterAfterResize({ prev: before, next, offsetX, offsetY, tileSize })
    const back = recenterAfterResize({
      prev: next, next: before, offsetX: there.offsetX, offsetY: there.offsetY, tileSize
    })
    expect(back.offsetX).toBeCloseTo(offsetX, 6)
    expect(back.offsetY).toBeCloseTo(offsetY, 6)
  })

  it('holds for a point the player panned away from the centre', () => {
    // the maths must not assume anything sits at the centre; an arbitrary point keeps its
    // position RELATIVE to the centre
    const next = { width: 1000, height: 700 }
    const moved = recenterAfterResize({ prev: before, next, offsetX: -40, offsetY: 310, tileSize })
    const offCentre = 7.75
    const wasRelative = screenOf(offCentre, -40, tileSize) - centerOf(before.width, before.height).x
    const nowRelative = screenOf(offCentre, moved.offsetX, tileSize) - centerOf(next.width, next.height).x
    expect(nowRelative).toBeCloseTo(wasRelative, 6)
  })
})
