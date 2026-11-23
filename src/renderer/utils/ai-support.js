// Can this game setup be played by AI players?
//
// The AI (the engine's LegacyAiPlayer) only knows part of the game. These lists are exactly what
// the former "Play with AI" mode offered: the tile sets it listed, and every element / variant it
// hid counts as not supported. Used by the setup screen (the AI badges and the "AI not available"
// notice) and by the slot page (the "AI player" button shows only for a supported setup).

import semver from 'semver'

import { Expansion } from '@/models/expansions'
import { GameElement, elementLocaleId, isConfigValueEnabled } from '@/models/elements'
import { Rule } from '@/models/rules'

// figures and mechanics the AI plays, by GameElement key — an ALLOWLIST: every other element
// switched on (including any new or add-on element nobody has checked yet) disables AI players
// unless an AI expansion brings it in itself. Add an element here only once the engine AI
// (LegacyAiPlayer / LegacyRanking) really handles it.
const AI_ELEMENT_KEYS = [
  'SMALL_FOLLOWER', 'BIG_FOLLOWER', 'BUILDER', 'PIG', 'PIG_HERD', 'TRADERS', 'FARMERS', 'CATHEDRAL',
  'INN', 'SHRINE', 'WELL'
]
// …and the expansion elements with no GameElement of their own (only tile features) that the AI
// plays: the River, Wind Roses, Labyrinth and Darmstadt (churches). NOT the watchtower: a meeple may
// be placed on it, and the AI has no idea what that is worth
const AI_ELEMENT_IDS = ['river', 'wind-rose', 'labyrinth', 'church']

// gameplay / scoring variants the AI plays at ANY value — an ALLOWLIST, like the elements: every
// other rule (including any new one) set away from its default disables AI players. Add a rule
// here only once the engine AI really handles its non-default value.
const AI_RULE_KEYS = [
  'INN_AND_CATHEDRAL_FINAL_SCORING', 'LABYRINTH_VARIANT', 'TINY_CITY_SCORING'
]

const ids = (registry, keys) => new Set(keys.map(k => registry[k] && registry[k].id).filter(Boolean))

/** Is this element (a GameElement, or its id) one the AI plays? */
export const isAiElement = item => {
  const id = typeof item === 'string' ? item : item && item.id
  return !!id && (ids(GameElement, AI_ELEMENT_KEYS).has(id) || AI_ELEMENT_IDS.includes(id))
}

// can the player switch this element off in the setup? (an element without a GameElement of its
// own — a bare tile feature like the river — cannot: implied, it is as good as enforced)
const isSwitchable = id => GameElement.all().some(e => e.id === id)

/**
 * A fan add-on's `<minimumVersionForAI>`: met by this app version? No tag → nothing to meet (the
 * elements decide). The tilemaker writes 9999.0.0 there for a tile feature the AI cannot handle.
 */
export const meetsAiVersion = (minimumVersionForAI, appVersion) => {
  if (minimumVersionForAI === null || minimumVersionForAI === undefined || minimumVersionForAI === '') return true
  const min = semver.coerce(minimumVersionForAI)
  const app = semver.coerce(appVersion)
  return !!min && !!app && semver.gte(app, min)
}

/**
 * How far the AI plays this expansion (an Expansion, or its name) — the four stages:
 *   'ai'       every element it enforces, implies or allows is one the AI plays
 *   'none'     an element the AI does not play is ENFORCED (or implied but cannot be switched
 *              off), or a fan add-on's minimumVersionForAI is not met — never with AI players
 *   'implied'  an element the AI does not play is IMPLIED (on by default): AI players only once
 *              it is switched off — the mechanic is then simply not part of the game (Tower)
 *   'allowed'  an element the AI does not play is only ALLOWED (off by default): AI players
 *              unless it is switched on (The City Gates' tunnels)
 * Returns { level, elements } — `elements` the ids behind 'implied' / 'allowed'.
 */
export const aiExpansionLevel = exp => {
  const e = typeof exp === 'string' ? Expansion[exp] : exp
  if (!e) return { level: 'none', elements: [] }
  // a fan add-on: `ai` = its minimumVersionForAI is met (plugins/tiles.js); its allowed elements
  // are kept apart (`allowedElements`) so they are not switched on by default
  if (e.fan && !e.ai) return { level: 'none', elements: [] }
  const notAi = list => (list || []).filter(id => !isAiElement(id))
  const implied = notAi(e.implies)
  if (notAi(e.enforces).length || implied.some(id => !isSwitchable(id))) return { level: 'none', elements: [] }
  if (implied.length) return { level: 'implied', elements: implied }
  const allowed = notAi(e.fan ? e.allowedElements : e.impliesAllowed)
  if (allowed.length) return { level: 'allowed', elements: allowed }
  return { level: 'ai', elements: [] }
}

/**
 * The sentence for an aiExpansionLevel() result (badge tooltip, tile-set popup); `vm` gives $t/$te.
 */
export const aiLevelText = ({ level, elements }, vm) => {
  // an element's name: game.element.<id>, else game.feature.<id> (e.g. families), else the id
  const names = elements.map(id => {
    const key = ['game.element.' + elementLocaleId(id), 'game.feature.' + id].find(k => vm.$te(k))
    return key ? vm.$t(key) : id
  }).join(', ')
  if (level === 'allowed') return vm.$t('game-setup.ai.supported-not-with', { elements: names })
  if (level === 'implied') return vm.$t('game-setup.ai.supported-only-without', { elements: names })
  if (level === 'none') return vm.$t('game-setup.ai.not-supported')
  return vm.$t('game-setup.ai.supported')
}

/** Can this expansion be part of a game with AI players at all (stages 'ai', 'allowed', 'implied')? */
export const isAiExpansion = exp => aiExpansionLevel(exp).level !== 'none'

/**
 * What in this setup the AI does not support. `setup` is { sets, elements, rules }; `tiles` is the
 * app's $tiles. An expansion of stage 'none' rules AI players out; otherwise every element switched
 * on must be one the AI plays — whoever switched it on (an implied tower, an allowed well): turned
 * off, the expansion is played without it. Returns { ok, expansions, elements, rules } (names / ids).
 */
export const aiSupport = (setup, tiles) => {
  const sets = (setup && setup.sets) || {}
  const elements = (setup && setup.elements) || {}
  const rules = (setup && setup.rules) || {}
  const edition = rules.edition || '2'

  const selected = Object.keys(tiles && tiles.getExpansions ? tiles.getExpansions(sets, edition) : {})
  const expansions = selected.filter(name => !isAiExpansion(name))

  const badElements = Object.entries(elements)
    .filter(([id, value]) => !isAiElement(id) && isConfigValueEnabled(value) && value !== null && value !== undefined)
    .map(([id]) => id)

  const aiRules = ids(Rule, AI_RULE_KEYS)
  const badRules = Rule.all()
    .filter(r => !aiRules.has(r.id) && rules[r.id] !== undefined && rules[r.id] !== r.default)
    .map(r => r.id)

  return {
    ok: !expansions.length && !badElements.length && !badRules.length,
    expansions,
    elements: badElements,
    rules: badRules
  }
}
