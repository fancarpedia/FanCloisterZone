import Vue from 'vue'
import uniq from 'lodash/uniq'
import mapKeys from 'lodash/mapKeys'

import { GameElement, isConfigValueEnabled, PRE_DRAW_INCOMPATIBLE } from '@/models/elements'
import { Rule, getDefaultRules } from '@/models/rules'
import { Expansion } from '@/models/expansions'
import { getSelectedEdition, getSelectedStartingTiles, getStartingTilesOptions } from '@/utils/gameSetupUtils'

const DEFAULT_SETS = {
  basic: 1
}

function getModifiedDefaults (before, after) {
  const keys = uniq([...Object.keys(before), ...Object.keys(after)])
  const diff = {}
  keys.forEach(cid => {
    if (before[cid] !== after[cid]) {
      diff[cid] = after[cid]
    }
  })
  return diff
}

function getEmptySlots () {
  const slots = []
  for (let i = 0; i < 9; i++) {
    slots.push({ number: i, clientId: null, sessionId: null, name: null })
  }
  return slots
}

// Build the wire `setup` from the current gameSetup state (used by createGame and by the
// live UPDATE_GAME_SETUP push while editing an online game's setup).
function buildSetupFromState (vm, state, getters) {
  const { $tiles } = vm
  const edition = getters.getSelectedEdition
  // Expansions whose tiles the user zeroed out entirely — dropped from the saved setup so a
  // standard game doesn't carry a tile set that contributes nothing.
  const emptied = $tiles.getEmptiedSets(state.sets, state.rules, edition, getters.selectedStartingTiles, state.tileOverrides)
  const sets = {}
  Object.entries(state.sets).forEach(([key, value]) => {
    if (emptied.includes(key)) return
    sets[$tiles.sets[key] ? key : key + ':' + edition] = value
  })
  // Addons come only from the KEPT sets — an emptied expansion (all tiles removed) is fully
  // dropped, addon included, so a standard game never carries an add-on that contributes no tiles.
  const addons = {}
  Object.keys($tiles.getExpansions(sets, edition)).forEach(id => {
    const { addon } = Expansion[id]
    if (addon) {
      addons[addon.id] = addon.json.version
    }
  })

  const setup = {
    sets,
    elements: state.elements,
    rules: state.rules,
    timer: state.timer,
    start: getters.selectedStartingTiles.value,
    ai: state.ai,
    // seating is randomized by default (owner can still turn it off on the slot page);
    // Keep Building always hides the remaining-tiles cheat sheet (locked on the slot page)
    options: {
      randomizeSeating: true,
      ...(state.elements['keep-building'] ? { puristTiles: true } : {})
    }
  }

  // per-tile count overrides (diffs from set defaults) — omitted entirely when untouched;
  // computed against the KEPT sets so 0-overrides for a dropped (emptied) expansion don't linger
  const tileOverrides = $tiles.getValidTileOverrides(
    sets, state.rules, edition, getters.selectedStartingTiles, state.tileOverrides
  )
  if (tileOverrides) {
    setup.tileOverrides = tileOverrides
  }
  // per-set breakdown, so the separated view's independent edits survive save/reload. The engine
  // ignores this field (it uses the flat tileOverrides → GAME_SETUP `tiles`). Drop emptied sets.
  const bySet = {}
  Object.entries(state.tileOverridesBySet || {}).forEach(([sk, tiles]) => {
    if (emptied.includes(sk)) return
    if (tiles && Object.keys(tiles).length) bySet[sk] = { ...tiles }
  })
  if (tileOverrides && Object.keys(bySet).length) {
    setup.tileOverridesBySet = bySet
  }

  if (Object.keys(addons).length) {
    setup.addons = addons
  }

  const rules = {}
  Rule.all().forEach(r => {
    if (r.isAvailable($tiles, setup)) {
      const val = state.rules[r.id]
      rules[r.id] = val === undefined ? r.default : val
    }
  })
  setup.rules = rules

  return setup
}

export const state = () => ({
  sets: null,
  excludedSets: {},
  elements: null,
  rules: null,
  start: null,
  timer: null,
  gameAnnotations: {},
  ai: false,
  editingGameId: null,
  preDrawSuspended: null, // pre-draw value stashed while an incompatible expansion is selected
  // per-tile count overrides: tileId -> count, stored only as diffs from the counts computed
  // from the selected sets (0 = tile excluded); empty when the pack is untouched. This is the
  // FLAT, engine-facing form (the sum across sets) — everything downstream reads it.
  tileOverrides: {},
  // per-SET breakdown of the above: { setKey: { tileId: count } }. Lets the separated tiles view
  // edit the SAME tileId provided by two sets (base+winter, river/1+river/2) independently; a
  // per-set edit recomputes that tile's flat total. Diffs-only, like tileOverrides.
  tileOverridesBySet: {},
  // Tiles-tab UI toggles, kept here (not in the component) so they survive the Tiles tab being
  // remounted when the owner goes back to change an already-created game. Window-scoped UI state,
  // NOT part of the setup sent to the engine.
  separateExpansions: false,
  quantityChange: false,
  // online-hotseat rematch: seats ({number, name}, in the new order) to auto-take when the
  // freshly created game arrives (server assigns seating by TAKE_SLOT sequence)
  rematchSlots: null,
  // Keep Building (coop variant) best-setups list from the server (Variant tab); null = not loaded
  coopLeaderboard: null,
  // most-played standard setups from the server (Variant tab); null = not loaded
  standardPopular: null,
  // most-popular sets / addons / components from the server (Variant tab), player-count independent
  standardPopularSets: null,
  standardPopularAddons: null,
  standardPopularComponents: null
})

export const mutations = {
  clear (state) {
    const { $tiles } = this._vm
    state.sets = { ...DEFAULT_SETS }
    state.excludedSets = {}
    state.elements = $tiles.getDefaultElements(DEFAULT_SETS)
    state.rules = getDefaultRules()
    state.start = null
    state.timer = null
    state.gameAnnotations = {}
    state.ai = false
    state.editingGameId = null
    state.preDrawSuspended = null
    state.tileOverrides = {}
    state.tileOverridesBySet = {}
    state.separateExpansions = false
    state.quantityChange = false
    state.rematchSlots = null
  },

  setAI (state) {
    state.ai = true
  },

  setEditingGameId (state, id) {
    state.editingGameId = id
  },

  setup (state, setup) {
    state.sets = setup.sets
    state.excludedSets = setup.excludedSets
    state.elements = setup.elements
    state.rules = setup.rules
    state.start = setup.start
    state.timer = setup.timer
    state.gameAnnotations = {}
    state.ai = setup.ai
    state.preDrawSuspended = null
    state.tileOverrides = setup.tileOverrides ? { ...setup.tileOverrides } : {}
    // deep-copy the per-set breakdown if the setup carries it (new format); older setups only
    // have the flat form, so the separated view falls back to per-set defaults for shared tiles
    state.tileOverridesBySet = setup.tileOverridesBySet
      ? JSON.parse(JSON.stringify(setup.tileOverridesBySet))
      : {}
    // Re-check "Enable quantity change" when the loaded setup already has tile-count changes (so
    // going back to change setup shows the counts as editable, matching the "tiles changed" note);
    // keep it on if it was already on. "Separate expansions" is retained window state (not touched).
    state.quantityChange = state.quantityChange || Object.keys(state.tileOverrides).length > 0
  },

  gameAnnotations (state, gameAnnotations) {
    state.gameAnnotations = gameAnnotations
  },

  preDrawSuspended (state, value) {
    state.preDrawSuspended = value
  },

  coopLeaderboard (state, value) {
    state.coopLeaderboard = value
  },

  standardPopular (state, value) {
    state.standardPopular = value
  },

  standardPopularSets (state, value) {
    state.standardPopularSets = value
  },

  standardPopularAddons (state, value) {
    state.standardPopularAddons = value
  },

  standardPopularComponents (state, value) {
    state.standardPopularComponents = value
  },

  tileSetQuantity (state, { id, quantity }) {
    if (isConfigValueEnabled(quantity)) {
      Vue.set(state.sets, id, quantity)
    } else {
      Vue.delete(state.sets, id)
    }
  },

  tileSetExcludedQuantity (state, { id, quantity }) {
    if (isConfigValueEnabled(quantity)) {
      Vue.set(state.excludedSets, id, quantity)
    } else {
      Vue.delete(state.excludedSets, id)
    }
  },

  elementConfig (state, { id, config }) {
    if (isConfigValueEnabled(config)) {
      Vue.set(state.elements, id, config)
    } else {
      Vue.delete(state.elements, id)
    }
  },

  ruleConfig (state, { id, config }) {
    state.rules[id] = config
  },

  timer (state, value) {
    state.timer = value
  },

  startingTiles (state, id) {
    state.start = id
  },

  tileOverride (state, { tileId, count }) {
    if (count === null || count === undefined) {
      Vue.delete(state.tileOverrides, tileId)
    } else {
      Vue.set(state.tileOverrides, tileId, count)
    }
  },

  tileOverrides (state, value) {
    state.tileOverrides = value || {}
  },

  // per-set override: state.tileOverridesBySet[setKey][tileId] = count (null → remove, and drop
  // the set bucket when it becomes empty)
  tileOverrideBySet (state, { setKey, tileId, count }) {
    if (count === null || count === undefined) {
      if (state.tileOverridesBySet[setKey]) {
        Vue.delete(state.tileOverridesBySet[setKey], tileId)
        if (!Object.keys(state.tileOverridesBySet[setKey]).length) {
          Vue.delete(state.tileOverridesBySet, setKey)
        }
      }
    } else {
      if (!state.tileOverridesBySet[setKey]) Vue.set(state.tileOverridesBySet, setKey, {})
      Vue.set(state.tileOverridesBySet[setKey], tileId, count)
    }
  },

  tileOverridesBySet (state, value) {
    state.tileOverridesBySet = value || {}
  },

  separateExpansions (state, value) {
    state.separateExpansions = !!value
  },

  quantityChange (state, value) {
    state.quantityChange = !!value
  },

  rematchSlots (state, value) {
    state.rematchSlots = value
  }
}

export const actions = {
  newGame ({ commit }) {
    commit('clear')
  },

  newGameAI ({ commit }) {
    commit('clear')
    commit('setAI')
  },

  load ({ commit }, setup) {
    const { $tiles } = this._vm
    const sets = mapKeys(setup.sets, (val, key) => key.split(':')[0])
    const excludedSets = {}
    const edition = setup.elements.garden ? 2 : 1
    const expansions = $tiles.getExpansions(sets, edition)
    Object.entries(expansions).forEach(([expId, quantity]) => {
      const expansion = Expansion[expId]
      for (const release of expansion.releases) {
        release.sets.forEach(id => {
          if ($tiles.isTileSetExcluded(id, expansions, edition)) {
            excludedSets[id] = quantity
          }
        })
      }
    })

    commit('setup', {
      ...setup,
      rules: { ...getDefaultRules(), ...setup.rules },
      sets,
      excludedSets
    })
  },

  setReleaseQuantity ({ state, getters, commit, dispatch }, { release, quantity }) {
    const { $tiles } = this._vm
    const enabledStateChanged = (!!release.sets.find(id => !!state.sets[id])) !== (quantity > 0)
    const before = enabledStateChanged ? $tiles.getDefaultElements(state.sets) : null
    release.sets.forEach(id => {
      if (state.excludedSets[id]) {
        commit('tileSetExcludedQuantity', { id, quantity })
      } else {
        commit('tileSetQuantity', { id, quantity })
      }
    })
    const edition = getters.getSelectedEdition
    const expansions = $tiles.getExpansions(state.sets, edition)
    const verifyExcluded = { ...state.excludedSets }
    Object.entries(state.sets).forEach(([id, quantity]) => {
      if ($tiles.isTileSetExcluded(id, expansions, edition)) {
        commit('tileSetQuantity', { id, quantity: 0 })
        commit('tileSetExcludedQuantity', { id, quantity })
        delete verifyExcluded[id]
      } else if (state.excludedSets[id]) {
        commit('tileSetQuantity', { id, quantity })
        commit('tileSetExcludedQuantity', { id, quantity: 0 })
      }
    })

    // and reeable no longer excluded sets
    Object.entries(verifyExcluded).forEach(([id, quantity]) => {
      if (!$tiles.isTileSetExcluded(id, expansions, edition)) {
        commit('tileSetQuantity', { id, quantity })
        commit('tileSetExcludedQuantity', { id, quantity: 0 })
      }
    })
    const after = enabledStateChanged ? $tiles.getDefaultElements(state.sets) : null

    if (enabledStateChanged) {
      const diff = getModifiedDefaults(before, after)
      Object.entries(diff).forEach(([id, config]) => {
        // use commit, not dispatch - bound meeples (eg mage/witch) are already reflected in rules
        commit('elementConfig', { id, config })
      })

      GameElement.all().forEach(ge => {
        if (ge.id in state.elements) {
          if (!$tiles.isElementEnabled(ge, state.sets, state.elements)) {
            commit('elementConfig', { id: ge.id, config: false })
          }
        }
      })
    }

    // A set may have enforced/removed an expansion (in)compatible with pre-draw — suspend or restore.
    dispatch('reconcilePreDraw')

    // The pack composition changed — drop per-tile overrides that no longer apply.
    dispatch('pruneTileOverrides')
  },

  // Set (or clear, when it matches the computed default) a per-tile count override.
  setTileOverride ({ state, commit, getters, dispatch }, { tileId, count }) {
    const { $tiles } = this._vm
    const defaults = $tiles.getTilesCounts(
      state.sets, state.rules, getters.getSelectedEdition, getters.selectedStartingTiles
    )
    if (defaults[tileId] === undefined) return
    const edition = getters.getSelectedEdition
    const before = $tiles.getDefaultElements(state.sets, state.tileOverrides, edition)
    commit('tileOverride', { tileId, count: count === defaults[tileId] ? null : count })
    // a flat (aggregate) edit supersedes any per-set split for this tile — drop it so the
    // separated view doesn't show a stale breakdown that disagrees with the flat total
    Object.keys(state.tileOverridesBySet).forEach(sk => {
      if (state.tileOverridesBySet[sk][tileId] !== undefined) {
        commit('tileOverrideBySet', { setKey: sk, tileId, count: null })
      }
    })
    dispatch('reconcileTileElements', { before })
  },

  // Per-set (separated view) edit: set (setKey, tileId) independently, then recompute the tile's
  // flat total = sum over every set of (per-set override ?? per-set default).
  setTileOverrideBySet ({ state, commit, getters, dispatch }, { setKey, tileId, count }) {
    const { $tiles } = this._vm
    const edition = getters.getSelectedEdition
    const bySetDefaults = $tiles.getTilesCountsBySet(state.sets, edition)
    const setDefault = bySetDefaults[setKey] ? bySetDefaults[setKey][tileId] : undefined
    if (setDefault === undefined) return // this set doesn't provide the tile
    const before = $tiles.getDefaultElements(state.sets, state.tileOverrides, edition)
    commit('tileOverrideBySet', { setKey, tileId, count: count === setDefault ? null : count })
    // recompute the flat total across ALL sets that provide this tile
    let total = 0
    let defaultTotal = 0
    Object.keys(bySetDefaults).forEach(sk => {
      const def = bySetDefaults[sk][tileId]
      if (def === undefined) return
      defaultTotal += def
      const bucket = state.tileOverridesBySet[sk]
      const ov = bucket ? bucket[tileId] : undefined
      total += (ov === undefined || ov === null) ? def : ov
    })
    commit('tileOverride', { tileId, count: total === defaultTotal ? null : total })
    dispatch('reconcileTileElements', { before })
  },

  // Wholesale replace of the overrides (Reset / Remove all buttons, unchecking quantity change).
  setTileOverrides ({ state, commit, getters, dispatch }, value) {
    const { $tiles } = this._vm
    const edition = getters.getSelectedEdition
    const before = $tiles.getDefaultElements(state.sets, state.tileOverrides, edition)
    commit('tileOverrides', value || {})
    commit('tileOverridesBySet', {}) // wholesale flat replace resets the per-set breakdown
    dispatch('reconcileTileElements', { before })
  },

  // Removing/restoring tiles changes what the pack allows: sync the implied element defaults
  // (e.g. inn/cathedral auto-uncheck when their tiles are gone, re-check when restored) and
  // force-disable checked elements whose tiles are no longer in the pack at all.
  reconcileTileElements ({ state, commit, getters }, { before }) {
    const { $tiles } = this._vm
    const edition = getters.getSelectedEdition
    const after = $tiles.getDefaultElements(state.sets, state.tileOverrides, edition)
    const diff = getModifiedDefaults(before, after)
    Object.entries(diff).forEach(([id, config]) => {
      commit('elementConfig', { id, config })
    })
    GameElement.all().forEach(ge => {
      if (ge.id in state.elements) {
        if (!$tiles.isElementEnabled(ge, state.sets, state.elements, state.tileOverrides, edition)) {
          commit('elementConfig', { id: ge.id, config: false })
        }
      }
    })
  },

  // Drop overrides for tiles no longer in the pack or equal to their computed default.
  pruneTileOverrides ({ state, commit, getters }) {
    // prune the per-set breakdown: drop buckets for sets no longer selected and per-set
    // overrides equal to (or no longer part of) that set's default
    if (Object.keys(state.tileOverridesBySet).length) {
      const defs = this._vm.$tiles.getTilesCountsBySet(state.sets, getters.getSelectedEdition)
      const prunedBySet = {}
      Object.entries(state.tileOverridesBySet).forEach(([sk, tiles]) => {
        if (!defs[sk]) return // set no longer selected
        const kept = {}
        Object.entries(tiles).forEach(([tid, c]) => {
          if (defs[sk][tid] !== undefined && defs[sk][tid] !== c) kept[tid] = c
        })
        if (Object.keys(kept).length) prunedBySet[sk] = kept
      })
      commit('tileOverridesBySet', prunedBySet)
    }
    if (!Object.keys(state.tileOverrides).length) return
    const { $tiles } = this._vm
    const valid = $tiles.getValidTileOverrides(
      state.sets, state.rules, getters.getSelectedEdition, getters.selectedStartingTiles,
      state.tileOverrides
    )
    commit('tileOverrides', valid || {})
  },

  // Suspend pre-draw (remembering its value) while an incompatible expansion is selected, and restore
  // it to that value once they are all removed. Keeps it unset if it was never set.
  reconcilePreDraw ({ commit, state }) {
    const eff = this._vm.$tiles.getFullSetup({ sets: state.sets, elements: state.elements }).elements
    const blocked = PRE_DRAW_INCOMPATIBLE.some(k => !!eff[k])
    const current = state.elements['pre-draw']
    if (blocked) {
      if (current) {
        commit('preDrawSuspended', current) // remember the setting
        commit('elementConfig', { id: 'pre-draw', config: 0 })
      }
    } else if (state.preDrawSuspended && !current) {
      commit('elementConfig', { id: 'pre-draw', config: state.preDrawSuspended }) // restore it
      commit('preDrawSuspended', null)
    }
  },

  setElementConfig ({ commit, state, dispatch }, { id, config }) {
    commit('elementConfig', { id, config })

    const linkedPairs = {
      mage: 'witch',
      witch: 'mage'
    }

    if (id in linkedPairs) {
      commit('elementConfig', { id: linkedPairs[id], config })
    } else if (id === 'abbot') {
      commit('elementConfig', { id: 'garden', config: config > 0 })
    } else if (id === 'garden') {
      if (config && !(state.elements.abbot > 0)) {
        commit('elementConfig', { id: 'abbot', config: 1 })
      }
    } else if (id === 'tower') {
      if (!config && (state.elements['black-tower'] > 0)) {
        commit('elementConfig', { id: 'black-tower', config: 0 })
      }
    } else if (id === 'black-tower') {
      if (config && !(state.elements.tower > 0)) {
        commit('elementConfig', { id: 'tower', config: 1 })
      }
    }

    // Keep Building (coop variant) plays without field scoring: farmers and the barn are
    // forced off while it is selected (their setup boxes are hidden, like ai:false does).
    // Not supported for AI games (for now) — refuse there.
    if (id === 'keep-building') {
      if (isConfigValueEnabled(config) && state.ai) {
        commit('elementConfig', { id: 'keep-building', config: false })
      } else if (isConfigValueEnabled(config)) {
        if (state.elements.farmers) commit('elementConfig', { id: 'farmers', config: false })
        if (state.elements.barn > 0) commit('elementConfig', { id: 'barn', config: 0 })
        // coop plays the standard pack — drop any per-tile count overrides
        if (Object.keys(state.tileOverrides).length) commit('tileOverrides', {})
      } else {
        commit('elementConfig', { id: 'farmers', config: true }) // back to the standard default
      }
    } else if ((id === 'farmers' || id === 'barn') && isConfigValueEnabled(config) && state.elements['keep-building']) {
      // refuse while the coop variant is on (boxes are hidden, but guard other write paths too)
      commit('elementConfig', { id, config: id === 'farmers' ? false : 0 })
    }

    // Pre-draw is mutually exclusive with expansions that change tile-draw or turn order.
    if (id === 'pre-draw') {
      // include enforced-by-set elements (River, Crop Circles, …), not just directly-set ones
      const eff = this._vm.$tiles.getFullSetup({ sets: state.sets, elements: state.elements }).elements
      if (isConfigValueEnabled(config) && PRE_DRAW_INCOMPATIBLE.some(k => !!eff[k])) {
        commit('elementConfig', { id: 'pre-draw', config: 0 }) // refuse — an incompatible expansion is on
      } else {
        commit('preDrawSuspended', null) // explicit user choice; forget any stashed value
      }
    } else if (PRE_DRAW_INCOMPATIBLE.includes(id)) {
      dispatch('reconcilePreDraw') // suspend on turning one on, restore once all are off
    }
  },

  setRuleConfig ({ commit }, { id, config }) {
    commit('ruleConfig', { id, config })
  },

  // Keep Building (coop variant): ask the server for the best-setups leaderboard.
  // The response arrives as a COOP_LEADERBOARD message (see store/networking.js).
  // `range` = 'month' (default) | 'year' | 'all' — time window over finished games.
  fetchCoopLeaderboard ({ rootState }, { players = null, range = 'month' } = {}) {
    if (rootState.networking.connectionType !== 'online') return
    const payload = { range }
    if (players) payload.players = players
    this._vm.$connection.send({ type: 'COOP_LEADERBOARD', payload })
  },

  // Standard game: ask the server for the most-played setups + popular sets/addons/components.
  // The response arrives as a STANDARD_POPULAR message (see store/networking.js).
  // `range` = 'month' (default) | 'year' | 'all' — time window over finished games.
  // The client sends the `components` allowlist (elements flagged popularComponent) so the
  // server aggregates their popularity WITHOUT needing an update when a new element is added.
  fetchStandardPopular ({ rootState }, { players = null, range = 'month' } = {}) {
    if (rootState.networking.connectionType !== 'online') return
    const payload = { range, components: GameElement.all().filter(e => e.popularComponent).map(e => e.id) }
    if (players) payload.players = players
    this._vm.$connection.send({ type: 'STANDARD_POPULAR', payload })
  },

  takeSlot ({ rootState }, { number, name }) {
    const g = rootState.game
    // Pre-draw is one-seat-per-app (the secret-hand redaction boundary): refuse a 2nd local slot.
    if (g.setup && g.setup.elements && g.setup.elements['pre-draw']) {
      const mySession = rootState.networking.sessionId
      if ((g.slots || []).some(s => s.sessionId === mySession)) return
    }
    this._vm.$connection.send({
      type: 'TAKE_SLOT',
      payload: { gameId: g.id, number, name }
    })
  },

  changeSlotToAi ({ rootState }, { number }) {
    this._vm.$connection.send({
      type: 'CHANGE_SLOT_TO_AI',
      payload: { gameId: rootState.game.id, number }
    })
  },

  renameSlot ({ rootState }, { number, name }) {
    this._vm.$connection.send({
      type: 'UPDATE_SLOT',
      payload: { gameId: rootState.game.id, number, name }
    })
  },

  releaseSlot ({ rootState }, { number }) {
    this._vm.$connection.send({
      type: 'LEAVE_SLOT',
      payload: { gameId: rootState.game.id, number }
    })
  },

  async changeGameSetup ({ state, commit, rootState, dispatch }) {
    const existingSetup = rootState.game.setup
    const existingGameId = rootState.game.id

    commit('setEditingGameId', existingGameId)
    await dispatch('load', existingSetup)
    this.$router.push('/game-setup')
  },

  async createGame ({ state, commit, getters, dispatch }, { loadedSetup, slots } = {}) {
    const { $tiles } = this._vm
    let setup

    if (loadedSetup) {
      setup = {
        options: {},
        ...loadedSetup
      }
      const rules = {}
      Rule.all().forEach(r => {
        if (r.isAvailable($tiles, setup)) {
          const val = state.rules[r.id]
          rules[r.id] = val === undefined ? r.default : val
        }
      })
      setup.rules = rules
    } else {
      setup = buildSetupFromState(this._vm, state, getters)
    }

    if (state.editingGameId) {
      // Update existing game instead of creating a new one
      this._vm.$connection.send({
        type: 'UPDATE_GAME_SETUP',
        payload: { gameId: state.editingGameId, setup }
      })
      commit('setEditingGameId', null)
    } else {
      const finalSlots = slots || getEmptySlots()

      dispatch('networking/startServer', {
        setup,
        slots: finalSlots,
        gameAnnotations: state.gameAnnotations
      }, { root: true })
    }
  },

  // Live update while editing an online game's setup: broadcast the current setup so every
  // connected player sees the change on the slot page immediately (not only after Continue).
  pushSetupUpdate ({ state, getters }) {
    if (!state.editingGameId) return
    const setup = buildSetupFromState(this._vm, state, getters)
    this._vm.$connection.send({
      type: 'UPDATE_GAME_SETUP',
      payload: { gameId: state.editingGameId, setup }
    })
  }
}

export const getters = {
  getSelectedEdition: state => getSelectedEdition(state.elements),
  startingTilesOptions: state => getStartingTilesOptions(state.elements, state.sets),
  selectedStartingTiles: state => getSelectedStartingTiles(state.elements, state.sets, state.start)
}
