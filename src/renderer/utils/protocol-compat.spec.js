import { describe, it, expect } from 'vitest'

import { isProtocolCompatible, protocolMismatch, sortByCompatibility, OWN_PROTOCOL } from './protocol-compat'

const client = (name, protocolVersion, minProtocolVersion) => ({ clientId: name, name, protocolVersion, minProtocolVersion })

describe('isProtocolCompatible', () => {
  it('accepts the same protocol', () => {
    expect(isProtocolCompatible(client('a', '7.1.0', '7.1.0'), client('b', '7.1.0', '7.1.0'))).toBe(true)
  })

  it('needs each side to meet the other one\'s minimum', () => {
    const me = client('me', '7.2.0', '7.1.0')
    expect(isProtocolCompatible(me, client('newer-tolerant', '7.3.0', '7.2.0'))).toBe(true)
    expect(isProtocolCompatible(me, client('too-old', '7.0.0', '7.0.0'))).toBe(false)
    expect(isProtocolCompatible(me, client('demands-newer', '7.4.0', '7.3.0'))).toBe(false)
  })

  it('treats a missing or unparseable version as incompatible', () => {
    expect(isProtocolCompatible(OWN_PROTOCOL, client('none'))).toBe(false)
    expect(isProtocolCompatible(OWN_PROTOCOL, client('no-min', '7.1.0'))).toBe(false)
    expect(isProtocolCompatible(OWN_PROTOCOL, client('bad', '6.2', '6.2'))).toBe(false)
  })

  it('rejects a legacy client as the server reports it (minimum = its own protocol)', () => {
    expect(isProtocolCompatible(OWN_PROTOCOL, client('legacy', '6.2.0', '6.2.0'))).toBe(false)
  })
})

describe('sortByCompatibility', () => {
  it('puts compatible players first and keeps the server order within each group', () => {
    const own = client('me', '7.1.0', '7.1.0')
    const list = [
      client('old1', '6.2.0', '6.2.0'),
      client('new1', '7.1.0', '7.1.0'),
      client('unknown'),
      client('new2', '7.1.0', '7.1.0'),
      client('old2', '6.2.0', '6.2.0')
    ]
    expect(sortByCompatibility(list, own).map(c => c.name)).toEqual(['new1', 'new2', 'old1', 'unknown', 'old2'])
  })

  it('handles an empty or missing list', () => {
    expect(sortByCompatibility([])).toEqual([])
    expect(sortByCompatibility(undefined)).toEqual([])
  })
})

describe('protocolMismatch', () => {
  const me = { protocolVersion: '7.1.0', minProtocolVersion: '7.1.0' }

  it('is null for a compatible client', () => {
    expect(protocolMismatch(me, { protocolVersion: '7.1.0', minProtocolVersion: '7.1.0' })).toBe(null)
  })

  it('says older when their protocol is below my minimum', () => {
    expect(protocolMismatch(me, { protocolVersion: '6.2.0', minProtocolVersion: '6.2.0' })).toBe('older')
  })

  it('says newer when they require a newer protocol than mine', () => {
    expect(protocolMismatch(me, { protocolVersion: '7.3.0', minProtocolVersion: '7.2.0' })).toBe('newer')
  })

  it('says unknown when a version is missing', () => {
    expect(protocolMismatch(me, { protocolVersion: '7.1.0' })).toBe('unknown')
  })
})
