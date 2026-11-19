// Can this game setup be played by AI players?
//
// The AI (the engine's LegacyAiPlayer) only knows part of the game. These lists are exactly what
// the former "Play with AI" mode offered: the tile sets it listed, and every element / variant it
// hid counts as not supported. Used by the setup screen (the AI badges and the "AI not available"
// notice) and by the slot page (the "AI player" button shows only for a supported setup).

import { Expansion } from '@/models/expansions'
import { GameElement, isConfigValueEnabled } from '@/models/elements'
import { Rule } from '@/models/rules'

// core / official tile sets the AI plays; fan expansions say so themselves (`ai: true`)
const AI_CORE_EXPANSIONS = new Set([
  'BASIC', 'START', 'INNS_AND_CATHEDRALS', 'TRADERS_AND_BUILDERS', 'RIVER', 'GQ11', 'CULT',
  'WIND_ROSES', 'WATCHTOWERS', 'DARMSTADT', 'LABYRINTH', 'SPIEL_DOCH'
])

// figures and mechanics the AI plays, by GameElement key — an ALLOWLIST: every other element
// switched on (including any new or add-on element nobody has checked yet) disables AI players
// unless an AI expansion brings it in itself. Add an element here only once the engine AI
// (LegacyAiPlayer / LegacyRanking) really handles it.
const AI_ELEMENT_KEYS = [
  'SMALL_FOLLOWER', 'BIG_FOLLOWER', 'BUILDER', 'PIG', 'TRADERS', 'FARMERS', 'CATHEDRAL', 'INN'
]

// gameplay / scoring variants the AI plays only at their default (the ones the AI mode hid)
const NON_AI_RULE_KEYS = [
  'BARN_PLACEMENT', 'BAZAAR_NO_AUCTION', 'BLACK_FAIRY_PLACEMENT', 'COC_FINAL_SCORING', 'COUNT_MOVE',
  'DRAGON_MOVEMENT', 'ESCAPE_VARIANT', 'FAIRY_PLACEMENT', 'FESTIVAL_RETURN', 'HILL_TIEBREAKER',
  'KEEP_MONASTERIES', 'KING_AND_ROBBER_SCORING', 'LITTLE_BUILDINGS_SCORING', 'METEORITE_IMPACT',
  'MORE_TUNNEL_TOKENS', 'PRINCESS_ACTION', 'ROBBERS_SON_ACTION', 'TUNNELIZE_OTHER_EXPANSIONS',
  'VINEYARDS_FOR_GARDEN', 'WAGON_MOVE'
]

const ids = (registry, keys) => new Set(keys.map(k => registry[k] && registry[k].id).filter(Boolean))

/** Is this expansion (an Expansion, or its name) one the AI plays? */
export const isAiExpansion = exp => {
  const e = typeof exp === 'string' ? Expansion[exp] : exp
  if (!e) return false
  return AI_CORE_EXPANSIONS.has(e.name) || (!!e.fan && !!e.ai)
}

/** Is this element (a GameElement, or its id) one the AI plays? */
export const isAiElement = item => {
  const id = typeof item === 'string' ? item : item && item.id
  return !!id && ids(GameElement, AI_ELEMENT_KEYS).has(id)
}

/**
 * What in this setup the AI does not support. `setup` is { sets, elements, rules }; `tiles` is the
 * app's $tiles. An element switched on by a selected AI expansion itself (e.g. Cult's shrines) is
 * fine — it is the expansion the AI plays. Returns { ok, expansions, elements, rules } (names / ids).
 */
export const aiSupport = (setup, tiles) => {
  const sets = (setup && setup.sets) || {}
  const elements = (setup && setup.elements) || {}
  const rules = (setup && setup.rules) || {}
  const edition = rules.edition || '2'

  const selected = Object.keys(tiles && tiles.getExpansions ? tiles.getExpansions(sets, edition) : {})
  const expansions = selected.filter(name => !isAiExpansion(name))

  const broughtIn = new Set()
  selected.filter(isAiExpansion).forEach(name => {
    const e = Expansion[name]
    if (!e) return
    ;[...(e.implies || []), ...(e.enforces || []), ...(e.impliesAllowed || [])].forEach(id => broughtIn.add(id))
  })
  const aiElements = ids(GameElement, AI_ELEMENT_KEYS)
  const badElements = Object.entries(elements)
    .filter(([id, value]) => !aiElements.has(id) && isConfigValueEnabled(value) && value !== null && value !== undefined && !broughtIn.has(id))
    .map(([id]) => id)

  const badRules = NON_AI_RULE_KEYS
    .map(k => Rule[k])
    .filter(r => r && rules[r.id] !== undefined && rules[r.id] !== r.default)
    .map(r => r.id)

  return {
    ok: !expansions.length && !badElements.length && !badRules.length,
    expansions,
    elements: badElements,
    rules: badRules
  }
}
