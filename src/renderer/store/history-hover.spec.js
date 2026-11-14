import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

import { actions, HISTORY_PANELS } from './board'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('clearHistoryHover', () => {
  it('removes the board dim and every panel a history event put in the action bar together', () => {
    const state = {
      layers: { EmphasizeLayer: {}, EventMeeplesLayer: {}, TileLayer: {} },
      historyHover: true
    }
    HISTORY_PANELS.forEach(p => { state[p] = { some: 'panel' } })
    const commit = vi.fn()
    const dispatch = vi.fn()
    actions.clearHistoryHover({ commit, dispatch, state })
    expect(dispatch.mock.calls).toEqual([
      ['hideLayer', { layer: 'EmphasizeLayer' }],
      ['hideLayer', { layer: 'EventMeeplesLayer' }]
    ])
    for (const p of ['pointsExpression', 'diceRollPanel', 'awardedMeeplePanel', 'returnedMeeplePanel', 'returnedTokenPanel', 'placementPanel']) {
      expect(commit).toHaveBeenCalledWith(p, null)
    }
    expect(commit).toHaveBeenCalledWith('historyHover', false)
  })
})

describe('touch taps', () => {
  it('a tap on the board clears the history hover; a mouse press does not', () => {
    expect(read('../components/game/Board.vue')).toMatch(/if \(ev\.pointerType !== 'mouse'\) \{\s*this\.\$store\.dispatch\('board\/clearHistoryHover'\)/)
  })

  it('a touch tap on a scoring bullet does not pin its breakdown', () => {
    const src = read('../components/game/play-events/PointsEvent.vue')
    expect(src).toContain('@pointerdown="pointerType = $event.pointerType"')
    expect(src).toContain("if (this.pointerType === 'touch' || this.pointerType === 'pen') return")
  })
})
