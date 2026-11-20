import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { isKingdomPalace, registerKingdomPalaces } from '@/utils/kingdom-palace'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(dir, 'PreDrawHand.vue'), 'utf8')

// pull a computed body out of the component source and run it against a fake `this`
const computedBody = (name) => {
  const start = src.indexOf('    ' + name + ' () {')
  return src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
}
// eslint-disable-next-line no-new-func
const supplyPlaceable = new Function('isKingdomPalace', computedBody('supplyPlaceable'))
const placeable = (items) => supplyPlaceable.call({ $store: { state: { game: { action: { items } } } } }, isKingdomPalace)

describe('pre-draw: automatic pass of an unplaceable supply tile', () => {
  it('a supply tile counts as placeable only when the engine offers it', () => {
    // palaces are known by their XML attribute kingdom-palace="<colour>" (plugins/tiles.js registers
    // them), whatever their id
    registerKingdomPalaces({ 'Kingdoms/KingdomPalaceBlue': 'blue', 'someaddon/MyPalace': 'red' })
    expect(placeable([{ type: 'TilePlacement', tileId: 'someaddon/MyPalace' }])).toBe(true)
    expect(placeable([{ type: 'PreDrawPlace' }])).toBe(false)
    expect(placeable([{ type: 'PreDrawPlace' }, { type: 'TilePlacement', tileId: 'AM/A' }])).toBe(true)
    expect(placeable([{ type: 'TilePlacement', tileId: 'Kingdoms/KingdomPalaceBlue' }])).toBe(true)
    // a bazaar tile is not an abbey / palace
    expect(placeable([{ type: 'TilePlacement', tileId: 'BA/C' }])).toBe(false)
  })

  it('passes automatically — once per turn — when the pass button applies but nothing can be placed', () => {
    expect(src).toContain('return this.canPassAbbey && !this.supplyPlaceable')
    expect(src).toMatch(/autoPassDue: \{\s+immediate: true,\s+handler \(due\) \{\s+if \(due && !this\.autoPassSent\) \{\s+this\.autoPassSent = true\s+this\.passAbbey\(\)/)
    // re-armed when the turn-part ends
    expect(src).toMatch(/myTurn \(val\) \{\s+if \(!val\) \{\s+this\.autoPassSent = false/)
  })
})
