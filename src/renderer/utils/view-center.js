// Geometry for keeping the board where the player is looking.
//
// Kept out of Board.vue so it can be exercised directly: the component needs a real svg, a
// pointer and a layout before any of this runs.

// Chrome taken by the panels drawn over the board: the players panel and the history strip on
// either side, the action bar across the top. The middle of what the player can actually SEE is
// therefore not the middle of the element.
export const PLAYERS_PANEL_WIDTH = 210
export const HISTORY_WIDTH = 80
export const ACTION_BAR_HEIGHT = 84

/** Middle of the visible board area for an element of this size. */
export const centerOf = (width, height) => ({
  x: HISTORY_WIDTH + (width - PLAYERS_PANEL_WIDTH - HISTORY_WIDTH) / 2,
  y: ACTION_BAR_HEIGHT + (height - ACTION_BAR_HEIGHT) / 2
})

/**
 * New pan offsets that put the board point which was under the old visible centre back under the
 * new one, after the element has changed size.
 *
 * The centre depends only on the size, so the old centre can be recovered from the size measured
 * last time - nothing has to be tracked while the player pans.
 */
export const recenterAfterResize = ({ prev, next, offsetX, offsetY, tileSize }) => {
  const was = centerOf(prev.width, prev.height)
  const boardX = (was.x - offsetX) / tileSize
  const boardY = (was.y - offsetY) / tileSize
  const now = centerOf(next.width, next.height)
  return {
    offsetX: now.x - boardX * tileSize,
    offsetY: now.y - boardY * tileSize
  }
}
