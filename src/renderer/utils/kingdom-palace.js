// Kingdoms (fan expansion): each player's Kingdom Palace tile is the one in their colour.
//
// A tile IS a Kingdom Palace by its XML attribute kingdom-palace="<colour>" (like wind-rose="NWSE"),
// never by its id — any add-on can define palace tiles. plugins/tiles.js registers them here while it
// parses the expansion XML (registerKingdomPalaces); the engine reads the same attribute
// (KingdomPalaceCapability.initTile) and deals each player the palace of their slot colour.
//
// The slot → color list is the shared one (utils/player-colors.js).
import { SLOT_COLORS, colorOfSlot } from '@/utils/player-colors'

// colour -> tile id, and the set of all palace tile ids (from the loaded expansion XML)
let palaceByColor = new Map()
let palaceIds = new Set()

/** Replace the known palace tiles: { tileId: colour }. Called by plugins/tiles.js. */
export const registerKingdomPalaces = byTileId => {
  palaceByColor = new Map()
  palaceIds = new Set()
  Object.entries(byTileId || {}).forEach(([tileId, color]) => {
    const c = String(color).trim().toLowerCase()
    if (!c) return
    palaceIds.add(tileId)
    if (!palaceByColor.has(c)) palaceByColor.set(c, tileId)
  })
}

/** The palace tile of a player slot's colour (null when no loaded expansion defines one). */
export const kingdomPalaceTileId = slot => palaceByColor.get(colorOfSlot(slot)) || null

/** Any palace tile (e.g. for an icon) — the first slot colour that has one. */
export const anyKingdomPalaceTileId = () => {
  for (const c of SLOT_COLORS) {
    if (palaceByColor.has(c)) return palaceByColor.get(c)
  }
  return palaceIds.size ? [...palaceIds][0] : null
}

export const isKingdomPalace = tileId => palaceIds.has(tileId)
