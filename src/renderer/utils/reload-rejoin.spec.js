import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { installReloadHook, takePendingRejoin, HOOK } from './reload-rejoin'

// Reloading the web build to a new version should put the player back in their game. The update
// bar is plain JS outside the app, so the app installs a hook it calls just before reloading:
// the hook records the open ONLINE game and closes the socket. Recording only at that instant is
// what keeps the value from going stale, and keeps local/loaded games (which have an id but
// nothing to rejoin) out of it entirely.
const makeStorage = () => {
  const data = new Map()
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
    size: () => data.size
  }
}

const makeStore = (networking, game) => {
  const dispatched = []
  return {
    state: { networking, game },
    dispatch: (type, payload) => { dispatched.push({ type, payload }) },
    dispatched
  }
}

const online = { connectionType: 'online', onlineEntry: 'fan' }

const hadStorage = Object.prototype.hasOwnProperty.call(globalThis, 'sessionStorage')
const originalStorage = globalThis.sessionStorage
const hadHook = Object.prototype.hasOwnProperty.call(globalThis, HOOK)

beforeEach(() => { globalThis.sessionStorage = makeStorage() })
afterEach(() => {
  if (hadStorage) globalThis.sessionStorage = originalStorage
  else delete globalThis.sessionStorage
  if (!hadHook) delete globalThis[HOOK]
})

describe('the hook the update bar calls', () => {
  it('is installed on window under the name the bar looks for', () => {
    installReloadHook(makeStore(online, { id: 'g1' }))
    expect(typeof globalThis[HOOK]).toBe('function')
  })

  it('records the open online game', () => {
    installReloadHook(makeStore(online, { id: 'g1' }))
    globalThis[HOOK]()
    expect(takePendingRejoin()).toEqual({ gameId: 'g1', entry: 'fan' })
  })

  it('keeps the entry point, so the reload reconnects the same way', () => {
    installReloadHook(makeStore({ connectionType: 'online', onlineEntry: 'plain' }, { id: 'g2' }))
    globalThis[HOOK]()
    expect(takePendingRejoin().entry).toBe('plain')
  })

  it('records nothing for a local game - it has an id but cannot be rejoined', () => {
    installReloadHook(makeStore({ connectionType: null, onlineEntry: null }, { id: 'local' }))
    globalThis[HOOK]()
    expect(takePendingRejoin()).toBe(null)
  })

  it('records nothing when no game is open', () => {
    installReloadHook(makeStore(online, { id: null }))
    globalThis[HOOK]()
    expect(takePendingRejoin()).toBe(null)
  })

  it('clears a previous record rather than leaving it to be rejoined', () => {
    installReloadHook(makeStore(online, { id: 'g1' }))
    globalThis[HOOK]()
    installReloadHook(makeStore({ connectionType: null }, { id: null }))
    globalThis[HOOK]()
    expect(takePendingRejoin()).toBe(null)
  })
})

describe('disconnecting before the reload', () => {
  it('closes the connection so the server drops the seat', () => {
    const store = makeStore(online, { id: 'g1' })
    installReloadHook(store)
    globalThis[HOOK]()
    expect(store.dispatched).toEqual([{ type: 'networking/close', payload: { redirect: false } }])
  })

  it('does not navigate - the page is about to reload', () => {
    const store = makeStore(online, { id: 'g1' })
    installReloadHook(store)
    globalThis[HOOK]()
    expect(store.dispatched[0].payload.redirect).toBe(false)
  })

  it('is not flagged as the user going offline, so the lobby still auto-connects', () => {
    const store = makeStore(online, { id: 'g1' })
    installReloadHook(store)
    globalThis[HOOK]()
    expect(store.dispatched[0].payload.userIntent).toBeUndefined()
  })

  it('disconnects even when there is no game to record', () => {
    const store = makeStore(online, { id: null })
    installReloadHook(store)
    globalThis[HOOK]()
    expect(store.dispatched).toHaveLength(1)
  })
})

describe('reading the record', () => {
  it('consumes it, so a failed rejoin is never retried', () => {
    installReloadHook(makeStore(online, { id: 'g1' }))
    globalThis[HOOK]()
    expect(takePendingRejoin()).not.toBe(null)
    expect(takePendingRejoin()).toBe(null)
  })

  it('is empty on a fresh tab', () => {
    expect(takePendingRejoin()).toBe(null)
  })

  it('ignores a corrupt record instead of throwing', () => {
    sessionStorage.setItem('fcz.rejoin', 'not json')
    expect(takePendingRejoin()).toBe(null)
  })

  it('ignores a record with no game id', () => {
    sessionStorage.setItem('fcz.rejoin', JSON.stringify({ entry: 'fan' }))
    expect(takePendingRejoin()).toBe(null)
  })
})

describe('when storage is unavailable', () => {
  beforeEach(() => {
    const boom = () => { throw new Error('denied') }
    globalThis.sessionStorage = { getItem: boom, setItem: boom, removeItem: boom }
  })

  it('still disconnects and still reloads - recording is the optional part', () => {
    const store = makeStore(online, { id: 'g1' })
    installReloadHook(store)
    expect(() => globalThis[HOOK]()).not.toThrow()
    expect(store.dispatched).toHaveLength(1)
  })

  it('reads nothing instead of throwing on boot', () => {
    expect(takePendingRejoin()).toBe(null)
  })
})
