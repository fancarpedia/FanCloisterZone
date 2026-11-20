// The player colors, by slot — the color a seat plays in. Shared by every expansion that hands a
// player something of their own color (Kingdoms' palaces: a tile with kingdom-palace="<color>" goes to
// the player whose slot has that color).
//
// Slot = index here. Keep in step with assets/styles/player-colors.scss and the engine's
// PlayerColors.SLOT_COLORS. Lower case, as written in the tile XML attributes.
export const SLOT_COLORS = [
  'red', 'blue', 'yellow', 'green', 'orange', 'purple', 'pink', 'white', 'black',
  // no slot uses these yet
  'gray', 'beige', 'brown'
]

/** The color of a slot (an unknown slot plays the first color). */
export const colorOfSlot = slot => SLOT_COLORS[slot] || SLOT_COLORS[0]

/** The slot of a color (case-insensitive), or null when no slot has it. */
export const slotOfColor = color => {
  const i = SLOT_COLORS.indexOf(String(color).trim().toLowerCase())
  return i < 0 ? null : i
}
