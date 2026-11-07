import { describe, it, expect } from 'vitest'
import { getters } from '@/store/game'

// "Rotate the placed tile" is decided entirely by the ENGINE, which publishes `tileRotation` when
// the tile already on the board may still be turned. The client deliberately keeps no memory of
// the placement: it used to track the position, the legal angles and the undo depth itself, and
// that state was lost on every reload, reconnect and game opened from a save, so the button
// silently disappeared. Reading it off engine state is what makes it survive all three.
const can = (state, isActionLocal = true) =>
  getters.canRotatePlacedTile(state, { isUndoAllowed: !!(state.undo?.allowed && isActionLocal) })

const rotation = (over = {}) => ({
  position: [0, 1],
  rotation: 90,
  rotations: [0, 90, 180, 270],
  tileId: 'BA/CcRr',
  ...over
})

describe('canRotatePlacedTile', () => {
  it('offers it when the engine publishes tileRotation', () => {
    expect(can({ tileRotation: rotation(), undo: { allowed: true } })).toBe(true)
  })

  it('refuses when the engine publishes nothing', () => {
    // the engine withholds it once something commits to the tile as it lies - a confirmed
    // Meteorite, the first Gold Ingot, a placed Mage or Witch - or the placement is not the
    // last move, or the square allows only one angle
    expect(can({ tileRotation: null, undo: { allowed: true } })).toBe(false)
    expect(can({ undo: { allowed: true } })).toBe(false)
  })

  it('refuses when the engine does not allow undo at all', () => {
    expect(can({ tileRotation: rotation(), undo: { allowed: false } })).toBe(false)
  })

  it("refuses when it is not this client's action", () => {
    expect(can({ tileRotation: rotation(), undo: { allowed: true } }, false)).toBe(false)
  })

  it('needs nothing the client has to remember', () => {
    // exactly the shape a freshly reconnected or reloaded client gets from the engine, with no
    // in-session history at all: the button must still be offered
    const fromEngineAlone = { tileRotation: rotation({ rotation: 180 }), undo: { allowed: true, depth: 4 } }
    expect(can(fromEngineAlone)).toBe(true)
  })
})
