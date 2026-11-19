// Kingdoms (fan expansion): each player's Kingdom Palace tile is the one in their colour.
//
// Slot → colour, as in assets/styles/player-colors.scss and the engine's
// KingdomPalaceCapability.SLOT_COLORS (keep the three in step). Gray / Beige / Brown have artwork
// but no slot yet.
export const SLOT_COLORS = [
  'Red', 'Blue', 'Yellow', 'Green', 'Orange', 'Purple', 'Pink', 'White', 'Black',
  'Gray', 'Beige', 'Brown'
]

export const KINGDOM_PALACE_PREFIX = 'Kingdoms/KingdomPalace'

export const kingdomPalaceTileId = slot => KINGDOM_PALACE_PREFIX + (SLOT_COLORS[slot] || SLOT_COLORS[0])

export const isKingdomPalace = tileId => typeof tileId === 'string' && tileId.startsWith(KINGDOM_PALACE_PREFIX)
