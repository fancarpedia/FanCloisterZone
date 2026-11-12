import semver from 'semver'

import { NETWORK_PROTOCOL_COMPATIBILITY, NETWORK_PROTOCOL_MINIMUM } from '@/constants/versions'

// This app's own protocol, in the shape the server reports for every connected client.
export const OWN_PROTOCOL = {
  protocolVersion: NETWORK_PROTOCOL_COMPATIBILITY,
  minProtocolVersion: NETWORK_PROTOCOL_MINIMUM
}

// Two clients can play together when each one's protocol is at least what the other requires.
// The server always reports both versions (for apps below 7.1, which send no minimum, it reports
// their own protocol as the minimum). A missing or unparseable version is incompatible.
export const isProtocolCompatible = (a, b) => protocolMismatch(a, b) === null

// Why b cannot play with a, from a's point of view: null when compatible, 'older' when b's
// protocol is below a's minimum, 'newer' when b requires a newer protocol than a has, 'unknown'
// when a version is missing or unparseable.
export const protocolMismatch = (a, b) => {
  const av = semver.valid(a && a.protocolVersion)
  const bv = semver.valid(b && b.protocolVersion)
  const amin = semver.valid(a && a.minProtocolVersion)
  const bmin = semver.valid(b && b.minProtocolVersion)
  if (!av || !bv || !amin || !bmin) return 'unknown'
  if (semver.lt(bv, amin)) return 'older'
  if (semver.lt(av, bmin)) return 'newer'
  return null
}

// Compatible clients first, incompatible after; the server's order is kept within each group.
export const sortByCompatibility = (clients, own = OWN_PROTOCOL) => {
  const compatible = []
  const incompatible = []
  for (const c of clients || []) {
    (isProtocolCompatible(own, c) ? compatible : incompatible).push(c)
  }
  return compatible.concat(incompatible)
}
