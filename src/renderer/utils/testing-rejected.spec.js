import { describe, it, expect } from 'vitest'

import { verifyScenario, rejectionText } from './testing'

// The engine lists the recorded moves it refused in the state's `rejected`. The Test Runner is
// strict about them: a refusal must be expected with a "Rejected: <tileId> <message>" assertion
// (e.g. the abbey may no longer go into a river gap), and an expected one must really happen.
const abbeyRefused = { type: 'PLACE_TILE', tileId: 'AM/A', message: 'Invalid placement [5,-2],R0' }
const state = rejected => ({ phase: 'TilePhase', players: [], rejected })
const failed = r => r.assertions.filter(a => a.result === false)

describe('Rejected: assertions', () => {
  it('text is the refused tile id, then the engine message', () => {
    expect(rejectionText(abbeyRefused)).toBe('AM/A Invalid placement [5,-2],R0')
    expect(rejectionText({ type: 'COMMIT', message: 'nope' })).toBe('nope')
  })

  it('an expected refusal passes', () => {
    const r = verifyScenario(state([abbeyRefused]), {
      description: 't',
      assertions: ['Phase is TilePhase', 'Rejected: AM/A Invalid placement [5,-2],R0']
    })
    expect(failed(r)).toEqual([])
  })

  it('an expected refusal that does not happen fails', () => {
    const r = verifyScenario(state(null), {
      description: 't',
      assertions: ['Rejected: AM/A Invalid placement [5,-2],R0']
    })
    expect(failed(r)).toHaveLength(1)
  })

  it('strict: an UNEXPECTED refusal fails the scenario even when every assertion passes', () => {
    const r = verifyScenario(state([abbeyRefused]), {
      description: 't',
      assertions: ['Phase is TilePhase']
    })
    const f = failed(r)
    expect(f).toHaveLength(1)
    expect(f[0].assertion).toBe('Rejected: AM/A Invalid placement [5,-2],R0')
  })
})
