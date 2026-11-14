import { describe, it, expect, vi } from 'vitest'

import { actions } from './game'

// The AI seat's owner asks its OWN engine for the AI's move and sends only that move; the request
// itself never reaches the server (the PHP server stored it as a move, then dropped the AI's real
// move with the same seq as a repeat, and relayed it to every client, each of which played the AI).

const makeCtx = engineResponse => {
  const writeMessage = vi.fn().mockResolvedValue({ response: engineResponse })
  const send = vi.fn()
  const ctx = {
    state: { id: 'g1', action: { player: 1 }, gameMessages: [{}, {}, {}], players: [] },
    dispatch: vi.fn(),
    commit: vi.fn(),
    rootState: { networking: { sessionId: 's' } }
  }
  const self = { _vm: { $engine: { get: () => ({ writeMessage }) }, $connection: { send } } }
  return { ctx, self, writeMessage, send }
}

describe('aiEngineRequest', () => {
  it('asks the local engine and sends only the move it gets back', async () => {
    const move = { type: 'PLACE_TILE', payload: { tileId: 'BA/C' }, player: 1 }
    const { ctx, self, writeMessage, send } = makeCtx({ type: 'AI_MESSAGE', payload: move })
    await actions.aiEngineRequest.call(self, ctx, {})
    const asked = writeMessage.mock.calls[0][0]
    expect(asked).toMatchObject({ type: 'AI', payload: { gameId: 'g1' }, seq: 4, player: 1 })
    expect(send).not.toHaveBeenCalled() // the AI request is not sent to the server
    expect(ctx.dispatch).toHaveBeenCalledWith('apply', { type: 'PLACE_TILE', payload: { tileId: 'BA/C' } })
  })

  it('sends nothing when the engine has no move', async () => {
    const { ctx, self } = makeCtx({ type: 'GAME' })
    await actions.aiEngineRequest.call(self, ctx, {})
    expect(ctx.dispatch).not.toHaveBeenCalled()
  })
})

describe('handleEngineMessage', () => {
  it('ignores an AI request relayed by a server (an older client’s): it is not ours to play', async () => {
    const { ctx, self, writeMessage } = makeCtx(null)
    await actions.handleEngineMessage.call(self, ctx, { type: 'AI', seq: 4, payload: { gameId: 'g1' }, player: 1 })
    expect(writeMessage).not.toHaveBeenCalled()
    expect(ctx.commit).not.toHaveBeenCalled()
    expect(ctx.dispatch).not.toHaveBeenCalled()
  })
})
