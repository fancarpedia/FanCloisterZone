import { describe, it, expect } from 'vitest'

import { systemChatText, setupDetailText } from '@/utils/chat-system'

// the owner's changes as the server posts them; $t shows the key and its params
const $t = (key, params) => key + (params ? ' ' + JSON.stringify(params) : '')

describe('systemChatText', () => {
  it('an ordinary message is not a system line', () => {
    expect(systemChatText({ message: 'hi' }, $t)).toBe(null)
  })

  it('an option turned on / off, by its take-slot label', () => {
    expect(systemChatText({ system: 'option', key: 'puristTiles', value: true, name: 'Ann' }, $t))
      .toBe('chat.system.option-on {"option":"game-setup.open-game.tournament-mode"}')
    expect(systemChatText({ system: 'option', key: 'publicGame', value: 'false', name: 'Ann' }, $t))
      .toBe('chat.system.option-off {"option":"game-setup.open-game.public-game"}')
  })

  it('max players: a number, or no limit', () => {
    expect(systemChatText({ system: 'option', key: 'maxPlayers', value: 3, name: 'Ann' }, $t))
      .toBe('chat.system.option-value {"option":"game-setup.open-game.max-players","value":3}')
    expect(systemChatText({ system: 'option', key: 'maxPlayers', value: 0, name: 'Ann' }, $t))
      .toContain('"value":"game-setup.open-game.max-players-no-limit"')
  })

  it('a setup edit lists what changed', () => {
    expect(systemChatText({ system: 'setup', changes: ['sets', 'timer'], name: 'Ann' }, $t))
      .toBe('chat.system.setup {"changes":"chat.system.setup-sets, chat.system.setup-timer"}')
  })

  it('unknown parts fall back to the English message', () => {
    expect(systemChatText({ system: 'option', key: 'somethingNew', value: true }, $t)).toBe(null)
    expect(systemChatText({ system: 'setup', changes: ['somethingNew'] }, $t)).toBe(null)
  })

  it('the exact changes of a live edit (1.78), in order', () => {
    const m = {
      system: 'setup',
      changes: ['sets', 'elements', 'timer'],
      details: [
        { kind: 'set', key: 'inns-and-cathedrals', from: null, to: 1 },
        { kind: 'set', key: 'traders-and-builders', from: 1, to: null },
        { kind: 'element', key: 'phantom', from: null, to: 1 },
        { kind: 'element', key: 'phantom-x', from: 1, to: 3 },
        { kind: 'timer', from: null, to: { initial: 600, turn: 30 } },
        { kind: 'tile', key: 'BA/C', set: null, from: null, to: 0 }
      ]
    }
    const text = systemChatText(m, $t)
    expect(text).toContain('chat.system.added {"name":"Inns & Cathedrals and phantom"}')
    expect(text).toContain('chat.system.removed {"name":"Traders & Builders"}')
    expect(text).toContain('chat.system.set-to {"name":"phantom x","value":3}')
    expect(text).toContain('chat.system.timer-set {"value":"10:00 + 0:30"}')
    expect(text).toContain('BA/C')
  })

  it('names come from the locale when it has them', () => {
    const $te = key => key.startsWith('chat.system.') || key === 'game.element.phantom' || key === 'expansion.inns-and-cathedrals'
    const $tt = (key, params) => key === 'game.element.phantom' ? 'Phantom'
      : key === 'expansion.inns-and-cathedrals' ? 'Hostince a katedrály'
        : $t(key, params)
    expect(systemChatText({ system: 'setup', details: [
      { kind: 'element', key: 'phantom', from: 1, to: 3 },
      { kind: 'set', key: 'inns-and-cathedrals:1', from: null, to: 2 }
    ] }, $tt, $te)).toBe('chat.system.set-to {"name":"Phantom","value":3}, chat.system.set-to {"name":"Hostince a katedrály","value":2}')
  })

  it('a removed timer, a changed start', () => {
    expect(setupDetailText({ kind: 'timer', from: { initial: 600 }, to: null }, $t)).toBe('chat.system.timer-removed')
    expect(setupDetailText({ kind: 'start' }, $t)).toBe('chat.system.start')
  })

  it('the added and the removed things each in one part (Abbot and Garden)', () => {
    const $te = key => key.startsWith('chat.system.') || ['game.element.abbot', 'game.element.garden'].includes(key)
    const $tt = (key, params) => key === 'game.element.abbot' ? 'Abbot' : key === 'game.element.garden' ? 'Garden' : $t(key, params)
    expect(systemChatText({ system: 'setup', details: [
      { kind: 'element', key: 'abbot', from: null, to: 1 },
      { kind: 'element', key: 'garden', from: null, to: true }
    ] }, $tt, $te)).toBe('chat.system.added {"name":"Abbot and Garden"}')
    expect(systemChatText({ system: 'setup', details: [
      { kind: 'element', key: 'abbot', from: 1, to: null },
      { kind: 'element', key: 'garden', from: true, to: null }
    ] }, $tt, $te, 'cs')).toMatch(/^chat\.system\.removed \{"name":"Abbot a\s+Garden"\}$/)
  })

  it('a tile count names the tile and its expansion', () => {
    const text = systemChatText({ system: 'setup', details: [
      { kind: 'tile', key: 'BA/RCr', set: 'basic:1', from: null, to: 3 },
      { kind: 'tile', key: 'IC/C', set: null, from: 2, to: null }
    ] }, $t)
    expect(text).toContain('BA/RCr (Base game)')
    expect(text).toContain('"value":3')
    expect(text).toContain('chat.system.tile-reset')
    expect(text).toContain('IC/C')
  })

  it('an edition switch is no change (Base game removed + added)', () => {
    expect(systemChatText({ system: 'setup', details: [
      { kind: 'set', key: 'basic:1', from: 1, to: null },
      { kind: 'set', key: 'basic:2', from: null, to: 1 },
      { kind: 'element', key: 'garden', from: null, to: true }
    ] }, $t)).toBe('chat.system.added {"name":"garden"}')
    expect(systemChatText({ system: 'setup', details: [
      { kind: 'set', key: 'basic:1', from: 1, to: null },
      { kind: 'set', key: 'basic:2', from: null, to: 1 },
      { kind: 'timer', from: null, to: { initial: 600 } }
    ] }, $t)).toBe('chat.system.timer-set {"value":"10:00"}')
  })

  it('a text missing in my language pack: null, the chat shows the English message', () => {
    const m = { system: 'setup', details: [{ kind: 'tile', key: 'BA/C', from: null, to: 3 }], message: 'changed the setup: set tile BA/C to 3' }
    const has = key => key !== 'chat.system.tile'
    expect(systemChatText(m, $t, has)).toBe(null)
    expect(systemChatText(m, $t, () => true)).toContain('chat.system.set-to')
    expect(systemChatText({ system: 'option', key: 'puristTiles', value: true }, $t, key => key !== 'chat.system.option-on')).toBe(null)
  })
})

