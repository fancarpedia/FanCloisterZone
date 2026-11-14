import { describe, it, expect, vi } from 'vitest'

import { actions } from './networking'

describe('disconnecting from the online server', () => {
  const run = connectionType => {
    const dispatch = vi.fn()
    const commit = vi.fn()
    const self = {
      _vm: { $server: { stop: vi.fn() }, $connection: { disconnect: vi.fn() }, $windows: null },
      $router: { currentRoute: { path: '/online' }, push: vi.fn() }
    }
    actions.close.call(self, { state: { connectionType }, commit, dispatch, rootState: { runningTests: true } }, { userIntent: true })
    return dispatch
  }

  it('clears the online lists (players, games)', () => {
    expect(run('online')).toHaveBeenCalledWith('online/onClose', null, { root: true })
  })

  it('leaves them alone when closing a local game connection', () => {
    expect(run('direct')).not.toHaveBeenCalled()
  })
})
