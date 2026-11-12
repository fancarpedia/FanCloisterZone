import { describe, it, expect } from 'vitest'

import { courierGhosts } from './courier-ghosts'

const letter = { position: [0, 0], feature: 'CourierLetter', location: 'I' }
const road = { position: [2, 0], feature: 'Road', location: 'NW' }
const city = { position: [2, -1], feature: 'City', location: 'N' }

describe('courierGhosts', () => {
  it('ghosts the courier on the letter symbol itself, not beside a meeple', () => {
    expect(courierGhosts(letter, road, () => true)).toEqual([
      { figure: 'courier', ptr: letter, nextToMeeple: false }
    ])
  })

  it('adds the destination, beside the meeple, once the courier has moved on', () => {
    expect(courierGhosts(road, city, () => false)).toEqual([
      { figure: 'courier', ptr: road, nextToMeeple: true },
      { figure: 'courier', ptr: city, nextToMeeple: true }
    ])
  })

  it('skips the destination while the courier still stands there', () => {
    expect(courierGhosts(road, city, p => p === city)).toHaveLength(1)
  })

  it('has no origin on the first placement', () => {
    expect(courierGhosts(null, letter, () => false)).toEqual([
      { figure: 'courier', ptr: letter, nextToMeeple: false }
    ])
  })
})
