import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { courierGhosts } from './courier-ghosts'

const letter = { position: [0, 0], feature: 'CourierLetter', location: 'I' }
const road = { position: [2, 0], feature: 'Road', location: 'NW' }
const city = { position: [2, -1], feature: 'City', location: 'N' }

describe('courierGhosts', () => {
  it('ghosts the courier on the letter symbol itself, not beside a meeple', () => {
    expect(courierGhosts(letter, road, () => true)).toEqual([
      { figure: 'courier', ptr: letter, nextToMeeple: false, role: 'from' }
    ])
  })

  it('adds the destination, beside the meeple, once the courier has moved on', () => {
    expect(courierGhosts(road, city, () => false)).toEqual([
      { figure: 'courier', ptr: road, nextToMeeple: true, role: 'from' },
      { figure: 'courier', ptr: city, nextToMeeple: true, role: 'to' }
    ])
  })

  it('skips the destination while the courier still stands there', () => {
    expect(courierGhosts(road, city, p => p === city)).toHaveLength(1)
  })

  it('has no origin on the first placement', () => {
    expect(courierGhosts(null, letter, () => false)).toEqual([
      { figure: 'courier', ptr: letter, nextToMeeple: false, role: 'to' }
    ])
  })
})

describe('the ghost layer tells the original spot from the new one', () => {
  const layer = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/game/layers/NeutralFigureGhostLayer.vue'), 'utf8')

  it('marks the origin ghost and rings it with a dashed circle', () => {
    expect(layer).toContain(":class=\"{ origin: g.role === 'from' }\"")
    expect(layer).toContain('class="origin-ring"')
    expect(layer).toContain(':stroke-dasharray=')
  })

  it('draws it grey and faintly pulsing in a turning dashed ring; the new spot keeps the bright pulse', () => {
    const origin = layer.slice(layer.indexOf('.origin' + String.fromCharCode(10)))
    expect(origin).toContain('animation: origin-ghost-pulse 1.6s ease-in-out infinite')
    expect(origin).toContain('filter: grayscale(1)')
    expect(origin).toContain('animation: origin-ring-spin 6s linear infinite')
    expect(origin).toContain('transform-origin: center')
    expect(layer).toContain('@keyframes origin-ring-spin')
  })
})
