import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'open-game.vue'), 'utf8')

// pull a computed out of the page and run it against a plain `this`
const computed = name => {
  const start = src.indexOf('    ' + name + ' () {')
  const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
  // eslint-disable-next-line no-new-func
  return ctx => new Function(body).call(ctx)
}
const canStart = computed('canStart')
const startInfo = computed('startInfo')
const slotsReserved = computed('slotsReserved')
const t = key => key

describe('a game needs a human player to start', () => {
  const human = { clientId: 'A', sessionId: 's', ai: false }
  const ai = { clientId: 'A', sessionId: 's', ai: true }

  it('AI players only: no start, and the header says why', () => {
    const slots = [ai, ai]
    const ctx = { slots, slotsAssigned: true, slotsReserved: slotsReserved({ slots }), $t: t }
    expect(canStart(ctx)).toBe(false)
    expect(startInfo(ctx)).toBe('game-setup.open-game.no-human-player')
  })

  it('a human with AI players starts', () => {
    const slots = [human, ai]
    const ctx = { slots, slotsAssigned: true, slotsReserved: slotsReserved({ slots }), $t: t }
    expect(canStart(ctx)).toBe(true)
    expect(startInfo(ctx)).toBe(null)
  })

  it('nobody seated yet: the old message', () => {
    const ctx = { slots: [{}], slotsAssigned: false, slotsReserved: false, readOnly: false, $t: t }
    expect(canStart(ctx)).toBe(false)
    expect(startInfo(ctx)).toBe('game-setup.open-game.no-player-in-game')
  })

  it('the header shows it', () => {
    expect(src).toContain(':info="startInfo"')
  })
})
