import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Highlighting a road that carries a bridge used to repaint the bridge WHITE in dark theme, so
// the bridge lost its colour exactly when the player was looking at it. With different kinds of
// bridge coming, each with its own colour, emphasis must never touch the fill - it outlines the
// bridge instead. There is no component-test harness here, so the contract is pinned at source
// level and the place-matching is exercised against a mirrored copy.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const src = fs.readFileSync(path.join(DIR, 'BridgeLayer.vue'), 'utf8').split(CR).join('')

const bodyOf = name => {
  const start = src.indexOf(`${name} (bridge) {`)
  if (start < 0) return ''
  return src.slice(start, src.indexOf('\n    },', start) + 1)
}

describe('the bridge keeps its own colour', () => {
  it('decides the fill without consulting the highlight', () => {
    const fill = bodyOf('fillColor')
    expect(fill).not.toBe('')
    expect(fill).not.toContain('emphasis')
    expect(fill).not.toContain('white')
  })

  it('leaves a hook for a kind-specific colour', () => {
    expect(bodyOf('fillColor')).toContain('bridge.color')
  })

  it('no longer paints any bridge white as a fill', () => {
    expect(src).not.toMatch(/return 'white'\s*\n\s*\}\s*\n\s*\}\s*\n\s*return 'brown'/)
  })
})

describe('the highlight shows as an outline instead', () => {
  it('binds the stroke rather than hard-coding it', () => {
    expect(src).toContain(':stroke="strokeColor(bridge)"')
  })

  it('keeps the fill bound to the bridge itself', () => {
    expect(src).toContain(':fill="fillColor(bridge)"')
  })

  it('only brightens the outline, and only in dark theme', () => {
    const stroke = bodyOf('strokeColor')
    expect(stroke).toContain("this.theme === 'dark'")
    expect(stroke).toContain('isEmphasized(bridge)')
    expect(stroke).toContain("'white'")
    expect(stroke).toContain("'black'")
  })
})

// mirrors isEmphasized - a bridge is part of the highlight when a place matches it exactly
describe('deciding whether a bridge is part of the highlighted feature', () => {
  const isEmphasized = (emphasis, bridge) => {
    if (emphasis?.type !== 'feature') return false
    return !!emphasis.places.find(({ location, tile }) =>
      bridge.location === location &&
      bridge.position[0] === tile.position[0] &&
      bridge.position[1] === tile.position[1]
    )
  }
  const bridge = { position: [1, 2], location: 'WE' }
  const feature = places => ({ type: 'feature', places })
  const place = (position, location) => ({ tile: { position }, location })

  it('matches a place on the same tile and location', () => {
    expect(isEmphasized(feature([place([1, 2], 'WE')]), bridge)).toBe(true)
  })

  it('ignores the same tile at another location', () => {
    expect(isEmphasized(feature([place([1, 2], 'NS')]), bridge)).toBe(false)
  })

  it('ignores the same location on another tile', () => {
    expect(isEmphasized(feature([place([9, 9], 'WE')]), bridge)).toBe(false)
  })

  it('finds it among several places', () => {
    const road = feature([place([0, 2], 'WE'), place([1, 2], 'WE'), place([2, 2], 'WE')])
    expect(isEmphasized(road, bridge)).toBe(true)
  })

  it('is false for a tile highlight, which has no places', () => {
    expect(isEmphasized({ type: 'tile', position: [1, 2] }, bridge)).toBe(false)
  })

  it('is false when nothing is highlighted', () => {
    expect(isEmphasized(undefined, bridge)).toBe(false)
  })
})
