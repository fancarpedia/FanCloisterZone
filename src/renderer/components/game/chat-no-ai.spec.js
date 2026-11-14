import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

// pull a computed body out of a component and run it against a plain `this`
const computed = (src, name) => {
  let start = src.indexOf('\n    ' + name + ' () {')
  if (start < 0) start = src.indexOf('\n    ' + name + '() {')
  const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    }', start))
  // eslint-disable-next-line no-new-func
  return ctx => new Function(body).call(ctx)
}

describe('AI seats neither chat nor count as local players', () => {
  it('in-game chat: no send button for an AI player run by this client', () => {
    const localPlayers = computed(read('GameChat.vue'), 'localPlayers')
    const players = [{ sessionId: 'me' }, { sessionId: 'me', ai: true }, { sessionId: 'other' }]
    expect(localPlayers({ players, sessionId: 'me' })).toEqual([0])
  })

  it('pre-game chat on the slot page: the same', () => {
    const localSlots = computed(read('../game-setup/OpenGameChat.vue'), 'localSlots')
    const slots = [{ number: 0, sessionId: 'me' }, { number: 1, sessionId: 'me', ai: true }]
    expect(localSlots({ slots, sessionId: 'me' }).map(s => s.number)).toEqual([0])
  })

  it('the local players limit counts human seats only', () => {
    const localSlotsCount = computed(read('../../pages/open-game.vue'), 'localSlotsCount')
    const slots = [{ sessionId: 'me' }, { sessionId: 'me', ai: true }, { sessionId: 'me', ai: true }]
    expect(localSlotsCount({ slots, sessionId: 'me' })).toBe(1)
  })
})

describe('"Limit reached" on a locked seat', () => {
  it('is centred on the name line with its help icon visible', () => {
    const slot = read('../game-setup/PlayerSlot.vue')
    const block = slot.slice(slot.indexOf('  .limit-reached\n'), slot.indexOf('  &.open, &.local, &.localai'))
    expect(block).toContain('display: inline-flex')
    expect(block).toContain('justify-content: center')
    expect(block).toMatch(/i\n\s+visibility: visible/)
  })
})
