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
  const sets = mapKeys(state.sets, (value, key) => {
    return $tiles.sets[key] ? key : key + ':' + edition
  })
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
    options: {}
  }

  // per-tile count overrides (diffs from set defaults) — omitted entirely when untouched
  const tileOverrides = $tiles.getValidTileOverrides(
    state.sets, state.rules, edition, getters.selectedStartingTiles, state.tileOverrides
  )
  if (tileOverrides) {
    setup.tileOverrides = tileOverrides
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
  // from the selected sets (0 = tile excluded); empty when the pack is untouched
  tileOverrides: {},
  // online-hotseat rematch: seats ({number, name}, in the new order) to auto-take when the
  // freshly created game arrives (server assigns seating by TAKE_SLOT sequence)
  rematchSlots: null
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
  },

  gameAnnotations (state, gameAnnotations) {
    state.gameAnnotations = gameAnnotations
  },

  preDrawSuspended (state, value) {
    state.preDrawSuspended = value
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
    dispatch('reconcileTileElements', { before })
  },

  // Wholesale replace of the overrides (Reset / Remove all buttons, unchecking quantity change).
  setTileOverrides ({ state, commit, getters, dispatch }, value) {
    const { $tiles } = this._vm
    const edition = getters.getSelectedEdition
    const before = $tiles.getDefaultElements(state.sets, state.tileOverrides, edition)
    commit('tileOverrides', value || {})
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
