import fs from 'fs'
import path from 'path'

import Vue from 'vue'
import sortBy from 'lodash/sortBy'
import isNil from 'lodash/isNil'
import { ipcRenderer } from 'electron'

import { Expansion, Release } from '@/models/expansions'
import { GameElement } from '@/models/elements'
import { EventsBase } from '@/utils/events'
import { registerKingdomPalaces } from '@/utils/kingdom-palace'
import { SLOT_COLORS } from '@/utils/player-colors'
import { meetsAiVersion } from '@/utils/ai-support'

const SIDES = ['N', 'E', 'S', 'W']
const EDGE_CODE = {
  city: 'c',
  road: 'r',
  farm: 'f',
  river: 'i',
  // the abbey tile's edges match any neighbour
  'abbey-edge': '*'
}

// the Rules tab's info dialogs: which tiles carry a feature that has no GameElement selector of its
// own — the base features (road, city, monastery), the farmers' fields and the abbot's gardens
const INFO_SELECTORS = { road: 'road', city: 'city', monastery: 'monastery', farmers: 'field', garden: 'garden' }

// Tiles NOT registered in the app (their tile-set references are dropped too): BT/* = Under the
// Big Top. Which tiles were skipped is printed to the APP console (the terminal, via the main
// process), not the browser devtools — a reminder that they are left out on purpose.
export const SKIPPED_TILE_PREFIXES = ['BT/']
const isSkippedTile = id => SKIPPED_TILE_PREFIXES.some(prefix => id.startsWith(prefix))

const UNKWNOWN_SET = { expansion: '_UNKNOWN', implies: [], impliesAllowed: [], allows: [] }

function getFeatureSignature (feature) {
  const attrs = feature.attributes
  const alist = [feature.tagName]
  for (let i = attrs.length - 1; i >= 0; i--) {
    alist.push(attrs[i].name + '=' + attrs[i].value)
  }
  alist.sort()
  // save edge code to first char for getEdge
  return EDGE_CODE[feature.tagName] + '|' + alist.join(',')
}

function getSymmetry (features) {
  const sym0 = (features.N !== features.S || features.NL !== features.SL || features.WR !== features.SR ||
          features.W !== features.E || features.WL !== features.EL || features.WR !== features.ER)
  if (sym0) return 0

  const sym2 = features.N !== features.E || features.NL !== features.EL || features.NR !== features.ER
  return sym2 ? 2 : 4
}

function getEdges (features) {
  const sides = []
  SIDES.forEach(side => {
    const f = features[side]
    if (f) {
      sides.push(f.charAt(0))
    } else {
      sides.push(features[side + 'L'] ? 'f' : '*')
    }
  })
  return sides.join('')
}

export class Tiles extends EventsBase {
  constructor (ctx) {
    super()
    this.ctx = ctx
    this.tiles = {}
    this.sets = {}
    this.expansionGroups = {}
    this.loaded = false
    this.expansions = []
    this.symbols = []
  }

  getExpansions (sets, edition) {
    const expansions = {}
    Object.entries(sets).forEach(([id, setCount]) => {
      if (setCount) {
        const set = this.sets[id] || this.sets[id + ':' + edition] || UNKWNOWN_SET

        if (expansions[set.expansion]) {
          expansions[set.expansion] = Math.max(expansions[set.expansion], setCount)
        } else {
          expansions[set.expansion] = setCount
        }
      }
    })
    return expansions
  }

  isTileSetExcluded (id, expansions, edition) {
    const set = this.sets[id] || this.sets[id + ':' + edition]
    const deps = set?.dependencies
    if (!deps) return false

    if (deps.expansion?.length && !deps.expansion.every(d => d in expansions)) return true

    if (deps.groups?.length) {
      for (const group of deps.groups) {
        const members = this.expansionGroups[group] || []
        if (!members.some(m => m in expansions)) return true
      }
    }

    return false
  }

  getTilesCounts (sets, rules, edition, start = null) {
    const counts = {}
    const remove = {}

    let specialMonasteries = false

    Object.entries(sets).forEach(([id, setCount]) => {
      if (!setCount) return

      const set = this.sets[id] || this.sets[id + ':' + edition] || UNKWNOWN_SET
      if (set !== UNKWNOWN_SET) { 
        Object.entries(set.tiles).forEach(([tileId, tileCount]) => {
          counts[tileId] = (counts[tileId] || 0) + setCount * tileCount
          const { max, min } = this.tiles[tileId]
          if (max) {
            counts[tileId] = Math.min(counts[tileId], max)
          }
		  if (min) {
		    counts[tileId] = Math.max(counts[tileId], min)
		  }
        })
        if (set.remove) {
          set.remove.forEach(id => { remove[id] = true })
        }
        if (set.enforces) {
          specialMonasteries ||= set.enforces.includes('monastery')
        }
      }
    })
    Object.keys(remove).forEach(id => { delete counts[id] })
    
    if (start) {
      if (counts['GQ/RFI']) {
        if (start.id === 'spring-alt') {
          delete counts['RI/s']
        } else {
          delete counts['GQ/RFI']
        }
      }
    }

    if (specialMonasteries && rules && rules['keep-monasteries'] === 'replace') {
      delete counts['BA/L']
      delete counts['BA/LR']
    }
    return counts
  }

  /**
   * The tiles carrying an element / base feature (e.g. 'inn', 'road'), for the Rules tab's info
   * dialog: { tiles: [{ id, count, total, expansion }], count, total } — `count` how many are in
   * the chosen pack (sets + per-tile overrides), `total` how many all tile sets of this edition
   * hold, `expansion` the name of the expansion it comes from (a tile shared by several sets, e.g.
   * base and Winter, goes to the first one that lists it).
   */
  getFeatureTiles (featureId, sets, tileOverrides, edition = '2') {
    const allSets = {}
    Object.keys(this.sets).forEach(key => {
      const m = /^(.*):(\d)$/.exec(key)
      if (m) {
        if (m[2] === String(edition)) allSets[m[1]] = 1
      } else if (!this.sets[key + ':' + edition]) {
        allSets[key] = 1
      }
    })
    const all = this.getTilesCounts(allSets, null, edition)
    const owner = {}
    Object.keys(allSets).forEach(key => {
      const set = this.sets[key] || this.sets[key + ':' + edition]
      if (!set || !set.tiles) return
      Object.keys(set.tiles).forEach(id => { if (!owner[id]) owner[id] = set.expansion || null })
    })
    const chosen = this.applyTileOverrides(this.getTilesCounts(sets || {}, null, edition), tileOverrides)
    const tiles = Object.keys(all)
      .filter(id => this.tileFeatures[id] && this.tileFeatures[id].has(featureId))
      .map(id => ({ id, count: chosen[id] || 0, total: all[id], expansion: owner[id] || null }))
      .sort((a, b) => (b.count > 0) - (a.count > 0) || a.id.localeCompare(b.id))
    return {
      tiles,
      count: tiles.reduce((sum, t) => sum + t.count, 0),
      total: tiles.reduce((sum, t) => sum + t.total, 0)
    }
  }

  // Per-set (release) RAW tile counts, before the global remove/max/min/start adjustments that
  // getTilesCounts applies. { setKey: { tileId: count } }. Used by the separated tiles view so
  // the SAME tileId provided by two sets (e.g. base+winter, river/1+river/2) can be shown and
  // edited independently per set. The engine still gets the flat SUM (see the store's flatten).
  getTilesCountsBySet (sets, edition) {
    const bySet = {}
    Object.entries(sets).forEach(([id, setCount]) => {
      if (!setCount) return
      const set = this.sets[id] || this.sets[id + ':' + edition]
      if (!set || set === UNKWNOWN_SET) return
      const counts = {}
      Object.entries(set.tiles || {}).forEach(([tileId, tileCount]) => {
        counts[tileId] = setCount * tileCount
      })
      bySet[id] = counts
    })
    return bySet
  }

  // Apply per-tile count overrides (diffs from the computed defaults) to a counts map.
  // Only tiles present in `counts` are affected — a stale override for a tile no longer in
  // the pack is ignored. An override of 0 removes the tile from the map.
  applyTileOverrides (counts, tileOverrides) {
    if (!tileOverrides || !Object.keys(tileOverrides).length) return counts
    const result = { ...counts }
    Object.entries(tileOverrides).forEach(([tileId, count]) => {
      if (result[tileId] === undefined) return
      if (count > 0) {
        result[tileId] = count
      } else {
        delete result[tileId]
      }
    })
    return result
  }

  // Set ids (as keyed in `sets`) whose tiles are ALL removed by the current overrides —
  // i.e. the set contributes no tile to the final pack. Sets without tiles are never emptied.
  // Used to drop an expansion from the saved setup when the user zeroed out all its tiles.
  getEmptiedSets (sets, rules, edition, start, tileOverrides) {
    if (!tileOverrides || !Object.keys(tileOverrides).length) return []
    const finalCounts = this.applyTileOverrides(this.getTilesCounts(sets, rules, edition, start), tileOverrides)
    const emptied = []
    Object.entries(sets).forEach(([id, setCount]) => {
      if (!setCount) return
      const set = this.sets[id] || this.sets[id + ':' + edition]
      const tileIds = set ? Object.keys(set.tiles || {}) : []
      if (tileIds.length && !tileIds.some(tid => finalCounts[tid] > 0)) {
        emptied.push(id)
      }
    })
    return emptied
  }

  // Overrides that are still meaningful for the given pack: keys present in the defaults
  // and differing from them. Returns null when nothing remains.
  getValidTileOverrides (sets, rules, edition, start, tileOverrides) {
    if (!tileOverrides || !Object.keys(tileOverrides).length) return null
    const defaults = this.getTilesCounts(sets, rules, edition, start)
    const valid = {}
    Object.entries(tileOverrides).forEach(([tileId, count]) => {
      if (defaults[tileId] === undefined) return
      if (defaults[tileId] === count) return
      valid[tileId] = count
    })
    return Object.keys(valid).length ? valid : null
  }

  // NB: without overrides both editions give the same TOTAL, but tile overrides are keyed by
  // per-edition tile ids/counts — callers editing the pack must pass the real edition (+ start).
  getPackSize (sets, rules, tileOverrides = null, edition = '1', start = null) {
    let countExp = 0
    // count "The Count of Carcassonne" as single tile
    if (sets.count) {
      sets = { ...sets }
      delete sets.count
      countExp = 1
    }

    let counts = this.getTilesCounts(sets, rules, edition, start)
    counts = this.applyTileOverrides(counts, tileOverrides)
    return countExp + Object.entries(counts).reduce((total, [tileId, tileCount]) => total + tileCount, 0)
  }

  // helper
  sortByEdge (a, b) {
    const ae = { c: 0, r: 0, i: 0 }
    const be = { c: 0, r: 0, i: 0 }
    a.edge.split('').forEach(ch => { ae[ch] += 1 })
    b.edge.split('').forEach(ch => { be[ch] += 1 })
    if (ae.i !== be.i) {
      return ae.i - be.i
    }
    if (ae.c !== be.c) {
      return be.c - ae.c
    }
    return ae.r - be.r // less roads first
  }

  // Element ids allowed by the tiles ACTUALLY in the pack — the selected sets' tiles with
  // the per-tile overrides applied (a tile overridden to 0 no longer contributes anything).
  getActiveAllows (sets, tileOverrides, edition = '1') {
    const counts = this.applyTileOverrides(this.getTilesCounts(sets, null, edition), tileOverrides)
    const allows = new Set([])
    Object.keys(counts).forEach(tileId => {
      const tileAllows = this.tileAllows[tileId]
      if (tileAllows) tileAllows.forEach(geId => allows.add(geId))
    })
    return allows
  }

  getDefaultElements (sets, tileOverrides = null, edition = '1') {
    const q = {}

    const implies = new Set([])
    const impliesAllowed = new Set([])
    let allows = new Set([])

    Object.keys(sets).forEach(id => {
      const set = this.sets[id] || this.sets[id + ':1'] || this.sets[id + ':2'] || UNKWNOWN_SET
      set.implies.forEach(elem => { implies.add(elem) })
      set.impliesAllowed.forEach(elem => { impliesAllowed.add(elem) })
      set.allows.forEach(elem => { allows.add(elem) })
    })

    // with per-tile overrides, only tiles still in the pack decide what is allowed
    const overridesActive = !!(tileOverrides && Object.keys(tileOverrides).length)
    if (overridesActive) {
      allows = this.getActiveAllows(sets, tileOverrides, edition)
    }

    GameElement.all().forEach(elem => {
      if (elem.default) {
        q[elem.id] = elem.default
        return
      }
      if (!(implies.has(elem.id) || (impliesAllowed.has(elem.id) && allows.has(elem.id)))) {
        return
      }
      // a selector-based element (tied to tile features, e.g. inn/cathedral) is only implied
      // while its tiles are actually in the pack — even when the expansion `implies` it
      if (overridesActive && elem.selector !== undefined && !allows.has(elem.id)) {
        return
      }
      q[elem.id] = elem.configType === Number ? 1 : true
    })

    // console.log(Object.keys(sets).join(',') + ' -> ' + Object.keys(q).join(','))
    return q
  }

  isElementEnabled (ge, enabledSets, enabledElements, tileOverrides = null, edition = '1') {
    if (ge.default !== undefined && ge.selector === undefined) return true
    if (tileOverrides && Object.keys(tileOverrides).length) {
      // a selector-based element follows the tiles actually left in the pack — a set-level
      // `implies` cannot keep it enabled once all of its tiles were removed
      if (ge.selector !== undefined) {
        return this.getActiveAllows(enabledSets, tileOverrides, edition).has(ge.id)
      }
      return Object.keys(enabledSets).find(id => {
        const set = this.sets[id] || this.sets[id + ':1'] || this.sets[id + ':2']
        return set.implies.includes(ge.id)
      }) !== undefined
    }
    return Object.keys(enabledSets).find(id => {
      const set = this.sets[id] || this.sets[id + ':1'] || this.sets[id + ':2']
      return set.allows.includes(ge.id) || set.implies.includes(ge.id)
    }) !== undefined
  }

  // Supply tiles in play: every supply set (<tile-set supply="true" element="…">) whose element is
  // on → { [element]: { count, tiles: [tileId…], setId } }. `count` is how many each player holds
  // (the element value; `true` = 1). Sent with the setup so the server needs no hardcoded tile ids.
  getSupply (elements) {
    const supply = {}
    Object.entries(this.sets).forEach(([setId, set]) => {
      if (!set.supplyTiles || !set.element) return
      const value = elements ? elements[set.element] : undefined
      if (value === undefined || value === null || value === false) return
      const count = value === true ? 1 : parseInt(value, 10)
      if (!(count > 0)) return
      const tiles = Object.keys(set.supplyTiles).filter(id => this.tiles[id])
      if (!tiles.length) return
      supply[set.element] = { count, tiles, setId }
    })
    return supply
  }

  // Player colours a game can seat, given its switched-on supply elements: a supply set whose
  // tiles belong to a player colour (Kingdom Palaces: kingdom-palace="<colour>") only has tiles for
  // some colours, and a player of another colour would get none. Returns the Set of allowed slot
  // numbers, or null when no switched-on element restricts the colours.
  getAllowedColorSlots (elements) {
    let allowed = null
    Object.values(this.getSupply(elements)).forEach(({ tiles }) => {
      const colors = new Set(tiles.map(id => this.tiles[id]?.kingdomPalace).filter(Boolean))
      if (!colors.size) return // not a per-colour supply
      const slots = new Set(SLOT_COLORS.map((c, slot) => colors.has(c) ? slot : null).filter(s => s !== null))
      allowed = allowed === null ? slots : new Set([...allowed].filter(s => slots.has(s)))
    })
    return allowed
  }

  // returns setup with enforced elements by expansion definitions
  getFullSetup (setup) {
    const elements = { ...setup.elements }

    Object.keys(setup.sets).forEach(id => {
      const set = this.sets[id] || this.sets[id + ':1'] || this.sets[id + ':2']
      ;(set?.enforces || []).forEach(id => { elements[id] = true })
    })

    return { ...setup, elements }
  }

  // One load at a time: a request while one runs (each add-on install asks for one) is folded into a
  // single re-run after it, so an older load can never finish last and put back a stale list.
  async loadExpansions () {
    if (this._expansionsLoading) {
      this._expansionsReloadPending = true
      return this._expansionsLoading
    }
    this._expansionsLoading = (async () => {
      do {
        this._expansionsReloadPending = false
        await this._loadExpansionsOnce()
      } while (this._expansionsReloadPending)
    })()
    try {
      await this._expansionsLoading
    } finally {
      this._expansionsLoading = null
    }
  }

  async _loadExpansionsOnce () {
    const gameElementsWithSelector = GameElement.all().filter(ge => ge.selector)

    const tiles = {}
    const sets = {}
    const expansions = []
    const xmls = []

    const expansionRequiredBy = {}
    const expansionGroups = {}
    const tileAllows = {}
    // per tile: every element / base feature it carries (selector matches) — Rules tab info dialogs
    const tileFeatures = {}
    // Kingdom Palace tiles: tile id -> player colour, from the tile attribute kingdom-palace="<colour>"
    const kingdomPalaces = {}

    const parser = new DOMParser()
    // the XML (fan / add-on) expansions read by this load, by name — registered all at once at the end
    const parsedExpansions = {}
    // tiles left out on purpose (SKIPPED_TILE_PREFIXES), reported once at the end of the load
    const skippedTiles = new Set()

    const parseXml = async (xml, addon) => {
      const content = await fs.promises.readFile(xml)
      const doc = parser.parseFromString(content, 'application/xml')

      xmls.push(xml)

      doc.querySelectorAll('tile[id]').forEach(t => {
        const id = t.getAttribute('id')
        if (isSkippedTile(id)) {
          skippedTiles.add(id)
          return
        }
        const features = {}
        for (const feature of t.children) {
          if (feature.childElementCount) continue // wagon move etc
          const content = feature.textContent.trim()
          if (content) {
            const signature = getFeatureSignature(feature)
            content.split(/\s+/).forEach(loc => {
              features[loc] = signature
            })
          }
        }

        const tile = {
          symmetry: getSymmetry(features),
          edge: getEdges(features)
        }

        const mx = t.getAttribute('max')
        if (mx) {
          tile.max = parseInt(mx)
        }

		const mn = t.getAttribute('min')
		if (mn) {
		  tile.min = parseInt(mn)
		}

        const palaceColor = t.getAttribute('kingdom-palace')
        if (palaceColor) {
          tile.kingdomPalace = palaceColor.trim().toLowerCase()
          kingdomPalaces[id] = tile.kingdomPalace
        }

        tiles[id] = tile

        const allows = tileAllows[id] = new Set([])
        gameElementsWithSelector.forEach(ge => {
          // a feature on the tile (road[inn], …) or an attribute of the tile itself ([bards-lute])
          if (t.querySelector(ge.selector) || (t.matches && t.matches(ge.selector))) {
            allows.add(ge.id)
          }
        })

        if (t.querySelectorAll('road[labyrinth=true]').length) {
          allows.add('labyrinth-variant')
        }

        // a feature can be an attribute of another one (the inn of a road: road[inn]) — the
        // selectors match it either way
        const feats = tileFeatures[id] = new Set(allows)
        Object.entries(INFO_SELECTORS).forEach(([fid, sel]) => {
          if (t.querySelector(sel)) feats.add(fid)
        })
      })

      doc.querySelectorAll('tile-set[id]').forEach(ts => {
        const id = ts.getAttribute('id')
        const max = ts.getAttribute('max')
		const min = ts.getAttribute('min')
        const setTiles = {}
        ts.querySelectorAll('ref').forEach(ref => {
          const tileId = ref.getAttribute('tile')
          if (tileId && isSkippedTile(tileId)) return // not registered (SKIPPED_TILE_PREFIXES)
          const count = ref.getAttribute('count')
          setTiles[tileId] = parseInt(count || 1)
        })
        // <tile-set supply="true">: tiles the expansion puts into players' supplies, never into the
        // draw pile (e.g. Kingdoms' Kingdom Palaces). They are kept apart in `supplyTiles` so pack
        // counts, overrides and the emptied-set logic never see them; the Tiles view lists them
        // read-only.
        // `element` names the setup element that hands these tiles out (abbey, kingdom-palace).
        const set = ts.getAttribute('supply') === 'true'
          ? { tiles: {}, supplyTiles: setTiles, element: ts.getAttribute('element') || null, allows: [] }
          : { tiles: setTiles, allows: [] }
        if (max) {
          set.max = parseInt(max)
        }
		if (min) {
		  set.min = parseInt(min)
		}
        const remove = Array.from(ts.querySelectorAll('remove')).map(r => r.getAttribute('tile'))
        if (remove.length) {
          set.remove = remove
        }

        ts.querySelectorAll('requires').forEach(el => {
          if (!set.dependencies) set.dependencies = {}
          const deps = set.dependencies
          const subj = el.attributes[0]
          if (subj && subj.name === 'expansion') {
            if (!deps.expansion) deps.expansion = []
            if (!expansionRequiredBy[subj.value]) expansionRequiredBy[subj.value] = []
            deps.expansion.push(subj.value)
            expansionRequiredBy[subj.value].push(id)
          } else if (subj && subj.name === 'group') {
            if (!deps.groups) deps.groups = []
            deps.groups.push(subj.value)
          } else {
            console.error('Invalid requires', el)
          }
        })
        sets[id] = set
      })
      
      const appVersion = await ipcRenderer.invoke('get-app-version')

      doc.querySelectorAll('expansion').forEach(el => {
        const name = el.getAttribute('id')

        // defined in JS (built-in), or by an XML already read in this load
        if (parsedExpansions[name] || (Expansion[name] && !Expansion[name].fan)) {
          console.error(`Expansion ${name} is already defined`)
          return
        }

        const title = el.querySelector('title').textContent || name
        const tileSets = Array.from(el.querySelectorAll('ref[tile-set]')).map(ref => ref.getAttribute('tile-set'))
        const enforces = Array.from(el.querySelectorAll('enforces[element]')).map(ref => ref.getAttribute('element'))
        const implies = Array.from(el.querySelectorAll('implies[element]')).map(ref => ref.getAttribute('element'))
        const allowedElements = Array.from(el.querySelectorAll('impliesAllowed[element]')).map(ref => ref.getAttribute('element'))
        const minimumVersionForAI = el.querySelector('minimumVersionForAI') || null
        // <maxSets>1</maxSets> / <minSets>: how many copies of the tile set a game may hold — the
        // NUMBER in the element (passing the element itself made Math.min() in ReleaseButtons NaN)
        const setsLimit = tag => {
          const n = parseInt(el.querySelector(tag)?.textContent, 10)
          return Number.isFinite(n) && n > 0 ? n : null
        }
        const maxSets = setsLimit('maxSets')
        const minSets = setsLimit('minSets')
        // AI players: the add-on's minimumVersionForAI (if any) is met — its elements decide the rest
        // (utils/ai-support.js aiExpansionLevel)
        const ai = meetsAiVersion(isNil(minimumVersionForAI) ? null : minimumVersionForAI.textContent.trim(), appVersion)

        const svgIcon = el.querySelector('icon svg')

        const groups = Array.from(el.querySelectorAll(':scope > group[id]')).map(g => g.getAttribute('id'))

        const exp = new Expansion(name, title, { enforces, implies, ai }, [new Release(name, tileSets, { max: maxSets, min: minSets } )])
        if (groups.length) exp.groups = groups
        // the elements it only allows — for the AI stages, NOT impliesAllowed (they stay off by default)
        exp.allowedElements = allowedElements
        if (svgIcon) {
          this.symbols.push(`<symbol id="expansion-${name}" viewBox="${svgIcon.getAttribute('viewBox')}">${svgIcon.innerHTML}</symbol>`)
          exp.svgIcon = true
        }
        if (addon) {
          exp.addon = addon
        }

        exp.links = []
        Array.from(el.querySelectorAll(':scope > link[url]')).forEach(link => {
          const title = link.getAttribute('title')
          const url = link.getAttribute('url')
          const type = link.getAttribute('type')
          exp.links.push({ title, url, type })
        })

        exp.description = el.querySelector(':scope > description')?.textContent || ''

        parsedExpansions[name] = exp
        expansions.push(exp)
        addon?.expansions.push(exp)
      })

      doc.querySelectorAll('expansion-groups > group[id]').forEach(groupEl => {
        const groupId = groupEl.getAttribute('id')
        if (!expansionGroups[groupId]) expansionGroups[groupId] = []
        groupEl.querySelectorAll('member[expansion]').forEach(member => {
          const expName = member.getAttribute('expansion')
          if (!expansionGroups[groupId].includes(expName)) {
            expansionGroups[groupId].push(expName)
          }
        })
      })
    }

    // load built-in expansions
    const lookupFolder = process.resourcesPath + '/expansions/'
    const listing = await fs.promises.readdir(lookupFolder)

    for (const f of listing) {
      if (f.substr(f.lastIndexOf('.') + 1) === 'xml') {
        await parseXml(lookupFolder + f, null)
      }
    }

    for (const addon of this.ctx.$addons.addons) {
      addon.expansions = []
      if (addon.error) continue
      for (const relPath of (addon.json.expansions || [])) {
        const fullPath = path.join(addon.folder, relPath)
        await parseXml(fullPath, addon)
      }
    }

    // Swap the expansion registry in ONE step — from here on nothing awaits, so the registry and the
    // sets below change together. Unregistering first and registering file by file (with awaits in
    // between) left windows where the old sets named expansions that were gone, and the lobby's
    // game overview crashed on `Expansion[name].releases` (undefined).
    if (skippedTiles.size) {
      const list = Array.from(skippedTiles).sort()
      ipcRenderer.send('app-console-log',
        `Tiles not registered on purpose (SKIPPED_TILE_PREFIXES ${SKIPPED_TILE_PREFIXES.join(', ')} in plugins/tiles.js): ${list.length} — ${list.join(', ')}`)
    }

    Expansion.unregisterAll()
    Object.values(parsedExpansions).forEach(exp => Expansion.register(exp))
    Expansion.all().forEach(exp => {
      delete exp.requiredBy
    })

    Object.entries(expansionRequiredBy).forEach(([expId, deps]) => {
      if (Expansion[expId]) {
        Expansion.requiredBy = { sets: deps }
      } else {
        console.warn('Unknown expansion reference ' + expId)
      }
    })

    Object.values(sets).forEach(set => {
      const allows = new Set([])
      Object.keys(set.tiles).forEach(id => {
        tileAllows[id].forEach(geId => allows.add(geId))
      })
      set.allows = Array.from(allows)
    })

    Expansion.all().forEach(exp => {
      exp.releases.forEach(release => {
        release.sets.forEach(baseId => {
          const ids = [baseId, baseId + ':1', baseId + ':2']
          ids.forEach(id => {
            if (sets[id]) {
              sets[id].expansion = exp.name
              sets[id].implies = exp.implies
              sets[id].impliesAllowed = exp.impliesAllowed
              sets[id].enforces = exp.enforces
            }
          })
        })
      })
    })

    // Merge groups from hardcoded JS expansions (exp.groups set via constructor options)
    // XML expansions already populated expansionGroups during parseXml via <group id="...">
    // and <expansion-groups> blocks — this picks up what JS-defined expansions contribute
    Expansion.all().forEach(exp => {
      for (const group of (exp.groups || [])) {
        if (!expansionGroups[group]) expansionGroups[group] = []
        if (!expansionGroups[group].includes(exp.name)) {
          expansionGroups[group].push(exp.name)
        }
      }
    })

    this.xmls = xmls
    this.tiles = tiles
    registerKingdomPalaces(kingdomPalaces)
    this.sets = sets
    this.tileAllows = tileAllows // per-tile element ids (selector matches), for override-aware availability
    this.tileFeatures = tileFeatures // per-tile element + base feature ids (Rules tab info dialogs)
    this.expansionGroups = expansionGroups
    this.expansions = sortBy(expansions, 'name')
    this.loaded = true

    if (this.symbols.length) {
      let symbolsContainer = document.getElementById('symbols')
      if (!symbolsContainer) {
        symbolsContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        symbolsContainer.setAttribute('id', 'symbols')
        document.body.appendChild(symbolsContainer)
      }
      symbolsContainer.innerHTML = this.symbols.join('\n')
    }

    this.ctx.app.store.commit('tilesLoaded')
    this.emit('load')
  }
}

export default (ctx, inject) => {
  let instance = null

  const prop = {
    get () {
      if (instance === null) {
        instance = new Tiles(ctx)
      }
      return instance
    }
  }
  
  Object.defineProperty(Vue.prototype, '$tiles', prop)
  Object.defineProperty(ctx, '$tiles', prop)
}