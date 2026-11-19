import { describe, it, expect } from 'vitest'

import { connectExceptionToMessage } from '@/utils/networking'

describe('connectExceptionToMessage', () => {
  it('describes a WebSocket close event instead of "[object CloseEvent]"', () => {
    expect(connectExceptionToMessage({ code: 1006, reason: '', wasClean: false }))
      .toBe('Connection closed (code 1006)')
    expect(connectExceptionToMessage({ code: 1008, reason: 'Policy violation', wasClean: true }))
      .toBe('Connection closed (code 1008: Policy violation)')
  })

  it('keeps the existing messages', () => {
    expect(connectExceptionToMessage({ error: { code: 'ECONNREFUSED' } })).toBe('Connection refused')
    expect(connectExceptionToMessage({ type: 'ERR', payload: { code: 'x', message: 'y' } })).toBe('x: y')
    expect(connectExceptionToMessage({})).toBe('Connection failed')
  })
})
