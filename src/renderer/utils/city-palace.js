// Kingdoms (fan expansion): each player's City Palace tile is the one in their colour.
//
// Slot → colour, as in assets/styles/player-colors.scss and the engine's
// CityPalaceCapability.SLOT_COLORS (keep the three in step). Gray / Beige / Brown have artwork
// but no slot yet.
export const SLOT_COLORS = [
  'Red', 'Blue', 'Yellow', 'Green', 'Orange', 'Purple', 'Pink', 'White', 'Black',
  'Gray', 'Beige', 'Brown'
]

export const CITY_PALACE_PREFIX = 'Kingdoms/CityPalace'

export const cityPalaceTileId = slot => CITY_PALACE_PREFIX + (SLOT_COLORS[slot] || SLOT_COLORS[0])

export const isCityPalace = tileId => typeof tileId === 'string' && tileId.startsWith(CITY_PALACE_PREFIX)
