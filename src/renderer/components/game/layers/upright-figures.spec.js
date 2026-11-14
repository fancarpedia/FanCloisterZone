import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import LayerMixin from './LayerMixin'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')
const upright = (boardRotation, ...args) => LayerMixin.methods.upright.call({ boardRotation }, ...args)

describe('upright()', () => {
  it('cancels the board rotation around the given point', () => {
    expect(upright(90, 10, 20)).toBe('rotate(-90 10 20)')
    expect(upright(270)).toBe('rotate(-270 0 0)')
  })

  it('is empty while the board is not turned', () => {
    expect(upright(0, 5, 5)).toBe('')
    expect(upright(undefined)).toBe('')
  })
})

describe('pieces and neutral figures stay upright on a turned board', () => {
  it('the lone neutral figures and the dragon (MeepleLayer)', () => {
    const src = read('MeepleLayer.vue')
    expect(src).toContain(":transform=\"donkeyTransform() + ' ' + upright(BASE_SIZE * 0.21, BASE_SIZE * 0.21)\"")
    expect(src).toContain(":transform=\"lonelyFairyTransform() + ' ' + upright(BASE_SIZE * 0.21, BASE_SIZE * 0.21)\"")
    expect(src).toContain(":transform=\"lonelyBlackFairyTransform() + ' ' + upright(BASE_SIZE * 0.21, BASE_SIZE * 0.21)\"")
    expect(src).toContain('upright(BASE_SIZE / 2, BASE_SIZE / 2)')
  })

  it('tower pieces, tokens and the hover ghosts', () => {
    expect(read('TowerLayer.vue')).toContain('rotate($' + '{-rotation} 0 0) $' + '{upright()}')
    const tokens = read('TokenLayer.vue')
    expect(tokens).toContain('upright(-40, -40)') // tunnel
    expect(tokens).toContain('upright(750, 92.5)') // gold
    expect(tokens).toContain('upright(132, 270)') // little building tower
    expect(tokens.split('upright(135, 135)')).toHaveLength(6) // the five gambler's luck shields
    expect(read('NeutralFigureGhostLayer.vue')).toContain("if (transform) transform += ' ' + this.upright()")
  })
})

describe('bridgeTransform()', () => {
  const bt = (boardRotation, location) => LayerMixin.methods.bridgeTransform.call({ boardRotation }, location)

  it('an east-west bridge flips on a board turned 180° or 270°', () => {
    expect(bt(0, 'WE')).toBe('')
    expect(bt(90, 'WE')).toBe('')
    expect(bt(180, 'WE')).toBe('rotate(180 450 450)')
    expect(bt(270, 'WE')).toBe('rotate(180 450 450)')
  })

  it('a north-south bridge starts at 90°, so it flips on a board turned 90° or 180°', () => {
    expect(bt(0, 'NS')).toBe('rotate(90 450 450)') // 90° on screen
    expect(bt(90, 'NS')).toBe('rotate(180 450 450) rotate(90 450 450)') // 180° → shown as 0°
    expect(bt(180, 'NS')).toBe('rotate(180 450 450) rotate(90 450 450)') // 270° → shown as 90°
    expect(bt(270, 'NS')).toBe('rotate(90 450 450)') // 360° = 0°
  })

  it('is used for placed bridges, the bridge choice and the placement preview', () => {
    expect(read('BridgeLayer.vue')).toContain(':transform="bridgeTransform(bridge.location)"')
    expect(read('BridgeSelectLayer.vue')).toContain(':transform="bridgeTransform(opt.location)"')
    expect(read('TilePlacementLayer.vue')).toContain(':transform="bridgeTransform(previewBridge.location)"')
  })
})
