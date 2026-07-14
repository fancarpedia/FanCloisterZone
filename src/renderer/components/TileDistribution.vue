<template>
  <div class="tile-distribution-wrap">
    <div v-if="editable" class="distribution-controls">
      <!-- separating expansions only makes sense with 2+ expansions that still have tiles -->
      <v-checkbox
        v-if="canSeparate"
        v-model="separateExpansions"
        :label="$t('game-setup.tiles.separate-expansions')"
        dense hide-details
      />
      <v-checkbox
        v-if="allowQuantityChange"
        v-model="quantityChange"
        :label="$t('game-setup.tiles.enable-quantity-change')"
        dense hide-details
      />
    </div>

    <!-- global actions only in the flat view — the separated view has them per expansion -->
    <div v-if="quantityEditActive && !separateExpansions" class="pack-actions">
      <v-btn small outlined :disabled="!hasAnyOverride" @click="resetTiles()">
        {{ $t('game-setup.tiles.reset-tiles') }}
      </v-btn>
      <v-btn small outlined :disabled="allTilesRemoved(tileItems)" @click="removeTiles(tileItems)">
        {{ $t('game-setup.tiles.remove-all-tiles') }}
      </v-btn>
    </div>

    <div
      v-for="(group, gi) in displayGroups"
      :key="group.id"
      ref="groupEl"
      class="group"
    >
      <h3 v-if="group.title !== null" class="group-title">
        <ExpansionSymbol v-if="group.expansion" :expansion="group.expansion" class="group-symbol" />
        {{ group.title }}&nbsp;({{ group.total }})
        <span class="group-nav">
          <v-btn icon x-small :disabled="gi === 0" :title="$t('game-setup.tiles.previous-expansion')" @click="scrollToGroup(gi - 1)">
            <v-icon x-small>fa-chevron-up</v-icon>
          </v-btn>
          <v-btn icon x-small :disabled="gi >= displayGroups.length - 1" :title="$t('game-setup.tiles.next-expansion')" @click="scrollToGroup(gi + 1)">
            <v-icon x-small>fa-chevron-down</v-icon>
          </v-btn>
        </span>
      </h3>

      <div v-if="quantityEditActive && group.title !== null && group.tiles.length" class="pack-actions group-actions">
        <v-btn x-small outlined :disabled="!hasGroupOverride(group.tiles)" @click="resetTiles(group.tiles)">
          {{ $t('game-setup.tiles.reset-tiles') }}
        </v-btn>
        <v-btn x-small outlined :disabled="allTilesRemoved(group.tiles)" @click="removeTiles(group.tiles)">
          {{ $t('game-setup.tiles.remove-all-tiles') }}
        </v-btn>
      </div>

      <div class="tile-distribution" :class="{ small }">
        <div
          v-for="{ id, count, rotation, cap, setKey } in group.tiles"
          :key="id"
          class="tile"
          :class="{ excluded: count === 0 }"
          :style="{ width: `${tileSize + 4}px` }"
        >
          <StandaloneTileImage
            :tile-id="id"
            :size="tileSize"
            :rotation="rotation"
            @click.native="onTileClick(id, count, setKey)"
          />
          <div v-if="!quantityEditActive" class="count">{{ count }}</div>
          <div v-else class="count stepper">
            <v-btn icon x-small :disabled="count <= 0" @click="changeCount(id, count, -1, setKey)">
              <v-icon x-small>fa-minus</v-icon>
            </v-btn>
            <span class="stepper-count">{{ count }}</span>
            <v-btn icon x-small :disabled="count >= cap" @click="changeCount(id, count, 1, setKey)">
              <v-icon x-small>fa-plus</v-icon>
            </v-btn>
          </div>
        </div>

        <div v-if="group.miniboard" class="tile">
          <CountMiniboard :size="77" />
          <div class="count">1</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import CountMiniboard from '@/components/game-setup/details/CountMiniboard'
import ExpansionSymbol from '@/components/ExpansionSymbol'

import { Expansion } from '@/models/expansions'
import { getSelectedEdition, getSelectedStartingTiles } from '@/utils/gameSetupUtils'

export default {
  components: {
    StandaloneTileImage,
    CountMiniboard,
    ExpansionSymbol
  },

  props: {
    sets: { type: Object, required: true },
    rules: { type: Object, default: null },
    tileSize: { type: Number, default: 100 },
    small: { type: Boolean, default: false },
    // read-only overrides for displaying a saved setup (bookmarks etc.)
    tileOverrides: { type: Object, default: null },
    // game-setup mode: header checkboxes + steppers editing gameSetup.tileOverrides
    editable: { type: Boolean, default: false },
    // whether changing per-tile COUNTS is allowed (the Keep Building variant allows separating
    // expansions but not editing tile counts, so it passes false here)
    allowQuantityChange: { type: Boolean, default: true }
  },

  data () {
    return {
      // fallbacks for the read-only (non-editable) display; in editable mode the toggles live in
      // the gameSetup store so they survive the Tiles tab remounting on "change setup"
      localSeparateExpansions: false,
      localQuantityChange: false
    }
  },

  watch: {
    // unchecking "Enable quantity change" resets the pack to the set defaults
    quantityChange (val) {
      if (!val && this.editable) {
        this.$store.dispatch('gameSetup/setTileOverrides', {})
      }
    }
  },

  computed: {
    // window-scoped in editable mode (persisted in the store), local otherwise
    separateExpansions: {
      get () {
        return this.editable ? this.$store.state.gameSetup.separateExpansions : this.localSeparateExpansions
      },
      set (val) {
        if (this.editable) this.$store.commit('gameSetup/separateExpansions', val)
        else this.localSeparateExpansions = val
      }
    },

    quantityChange: {
      get () {
        return this.editable ? this.$store.state.gameSetup.quantityChange : this.localQuantityChange
      },
      set (val) {
        if (this.editable) this.$store.commit('gameSetup/quantityChange', val)
        else this.localQuantityChange = val
      }
    },

    ...mapState({
      edition: state => {
        const setup = state.gameSetup || state.game.setup
        return getSelectedEdition(setup.elements)
      },
      start: state => {
        const setup = state.gameSetup || state.game.setup
        const { elements, sets, start } = setup
        return getSelectedStartingTiles(elements, sets, start)
      },
      storeOverrides: state => state.gameSetup.tileOverrides,
      storeOverridesBySet: state => state.gameSetup.tileOverridesBySet || {}
    }),

    quantityEditActive () {
      return this.editable && this.quantityChange && this.allowQuantityChange
    },

    hasAnyOverride () {
      return !!this.storeOverrides && Object.keys(this.storeOverrides).length > 0
    },

    // pre-placed starting tiles must stay in the pack: tileId -> minimum kept count
    startTileCounts () {
      const counts = {}
      if (this.start && this.start.value) {
        this.start.value.forEach(({ tile }) => { counts[tile] = (counts[tile] || 0) + 1 })
      }
      return counts
    },

    effectiveOverrides () {
      if (this.editable) return this.storeOverrides
      return this.tileOverrides
    },

    baseSets () {
      if (!this.sets.count) return this.sets
      const sets = { ...this.sets }
      delete sets.count
      return sets
    },

    // per-tile counts computed from the selected sets (before overrides)
    defaultCounts () {
      return this.$tiles.getTilesCounts(this.baseSets, this.rules, this.edition, this.rules === null ? null : this.start)
    },

    // stepper upper bound: tiles are freely increasable (e.g. 4× the single BA/Cccc+),
    // except when the tile definition declares a hard XML `max` — the engine clamps to
    // it anyway, so the UI must not suggest more
    caps () {
      const caps = {}
      Object.entries(this.defaultCounts).forEach(([id, count]) => {
        const max = this.$tiles.tiles[id]?.max
        caps[id] = max ? Math.max(count, max) : 99
      })
      return caps
    },

    tileItems () {
      const counts = this.defaultCounts
      const overrides = this.effectiveOverrides
      const tiles = Object.keys(counts).map(id => ({ id, ...this.$tiles.tiles[id] }))
      tiles.sort(this.$tiles.sortByEdge)
      return tiles.map(t => {
        const themeTile = this.$theme.getTile(t.id)
        const ov = overrides ? overrides[t.id] : undefined
        return {
          id: t.id,
          count: ov === undefined || ov === null ? counts[t.id] : ov,
          cap: this.caps[t.id],
          rotation: themeTile ? themeTile.rotation : 0
        }
      })
    },

    // more than one expansion still contributes tiles → separating them is meaningful.
    // Reacts to tile removal: drop all of an expansion's tiles and it stops counting.
    canSeparate () {
      // Count SELECTED tile SETS (releases), regardless of current tile counts. Per-set grouping
      // means two releases of one expansion (river/1 + river/2) are separable too. Selection-based
      // so it stays available when a player zeroes a set's tiles to hand-pick a few.
      let n = 0
      for (const id of Object.keys(this.baseSets)) {
        if (!this.baseSets[id]) continue
        const set = this.$tiles.sets[id] || this.$tiles.sets[id + ':' + this.edition]
        if (set && set.tiles && Object.keys(set.tiles).length) {
          if (++n > 1) return true
        }
      }
      return false
    },

    // one flat pseudo-group, or (editable + separate view) a group per expansion
    displayGroups () {
      // collapse to the flat single-group view (no per-expansion arrows) unless separation is
      // both requested AND meaningful (2+ expansions with tiles) — reacts as tiles are removed
      if (!this.editable || !this.separateExpansions || !this.canSeparate) {
        return [{
          id: 'all',
          title: null,
          expansion: null,
          total: this.tileItems.reduce((sum, t) => sum + t.count, 0),
          tiles: this.tileItems,
          miniboard: !!this.sets.count
        }]
      }

      // one group per SET/release, so the SAME tileId provided by two sets (base+winter,
      // river/1+river/2) shows and edits independently per set. Per-set counts come from
      // getTilesCountsBySet + the per-set overrides; the engine still gets the flat sum.
      const bySetDefaults = this.$tiles.getTilesCountsBySet(this.baseSets, this.edition)
      const overridesBySet = this.storeOverridesBySet
      const tileOrder = this.tileItems.map(t => t.id) // global edge-sorted order
      const orderIndex = {}
      tileOrder.forEach((id, i) => { orderIndex[id] = i })

      const groups = []
      // follow the sets' natural order as keyed in the store
      Object.keys(bySetDefaults).forEach(setKey => {
        const perSet = bySetDefaults[setKey]
        const ov = overridesBySet[setKey] || {}
        const tiles = Object.keys(perSet)
          .sort((a, b) => (orderIndex[a] ?? 1e9) - (orderIndex[b] ?? 1e9))
          .map(tileId => {
            const count = ov[tileId] === undefined ? perSet[tileId] : ov[tileId]
            const themeTile = this.$theme.getTile(tileId)
            return {
              id: tileId,
              count,
              cap: this.caps[tileId] || 99,
              rotation: themeTile ? themeTile.rotation : 0,
              setKey
            }
          })
        if (!tiles.length) return
        groups.push({
          id: 'set:' + setKey,
          title: this.setTitle(setKey),
          expansion: this.expansionForSet(setKey),
          total: tiles.reduce((sum, t) => sum + t.count, 0),
          tiles,
          miniboard: false,
          setKey
        })
      })

      if (this.sets.count) {
        groups.push({
          id: '_count',
          title: null,
          expansion: null,
          total: 1,
          tiles: [],
          miniboard: true
        })
      }
      return groups
    }
  },

  methods: {
    expansionTitle (expansion) {
      const langId = 'expansion.' + expansion.name.toLowerCase().replace(/_/g, '-')
      return this.$te(langId) ? this.$t(langId) : expansion.title
    },

    // the release + expansion that owns a set key (edition suffix stripped)
    releaseForSet (setKey) {
      const base = setKey.split(':')[0]
      for (const exp of Expansion.all()) {
        for (const r of exp.releases) {
          if (r.sets.includes(base)) return { release: r, expansion: exp }
        }
      }
      return null
    },

    // label for a per-set group: the release title (e.g. "The River I"), else the expansion title
    setTitle (setKey) {
      const found = this.releaseForSet(setKey)
      return found ? (found.release.title || this.expansionTitle(found.expansion)) : setKey
    },

    expansionForSet (setKey) {
      const found = this.releaseForSet(setKey)
      return found ? found.expansion : null
    },

    // clicking a removed (count 0) tile brings it back with a single copy
    onTileClick (tileId, count, setKey = null) {
      if (this.quantityEditActive && count === 0) {
        this.changeCount(tileId, 0, 1, setKey)
        return
      }
      this.$emit('tile-click', tileId, count)
    },

    // setKey present (separated view) → edit that set's copy independently; else the flat total
    changeCount (tileId, count, delta, setKey = null) {
      const next = Math.min(Math.max(count + delta, 0), this.caps[tileId] || 99)
      if (next === count) return
      if (setKey) {
        this.$store.dispatch('gameSetup/setTileOverrideBySet', { setKey, tileId, count: next })
      } else {
        this.$store.dispatch('gameSetup/setTileOverride', { tileId, count: next })
      }
    },

    hasGroupOverride (tiles) {
      // per-set group → check the nested breakdown; flat group → the flat overrides
      if (tiles.length && tiles[0].setKey) {
        return tiles.some(t => {
          const b = this.storeOverridesBySet[t.setKey]
          return b && b[t.id] !== undefined
        })
      }
      if (!this.storeOverrides) return false
      return tiles.some(t => this.storeOverrides[t.id] !== undefined)
    },

    allTilesRemoved (tiles) {
      // "removed" = at the minimum count (0, or the kept count for pre-placed starting tiles)
      return tiles.length > 0 && tiles.every(t => t.count === (this.startTileCounts[t.id] || 0))
    },

    // restore defaults — for all tiles (no argument), a per-set group, or a flat group
    resetTiles (tiles = null) {
      if (tiles === null) {
        this.$store.dispatch('gameSetup/setTileOverrides', {})
        return
      }
      if (tiles.length && tiles[0].setKey) {
        // per-set: set each back to its per-set default (which clears the nested override)
        const defs = this.$tiles.getTilesCountsBySet(this.baseSets, this.edition)
        tiles.forEach(t => {
          const d = defs[t.setKey] ? defs[t.setKey][t.id] : undefined
          this.$store.dispatch('gameSetup/setTileOverrideBySet', { setKey: t.setKey, tileId: t.id, count: d })
        })
        return
      }
      const next = { ...this.storeOverrides }
      tiles.forEach(t => { delete next[t.id] })
      this.$store.dispatch('gameSetup/setTileOverrides', next)
    },

    // jump to the previous/next expansion section (refs collected by the v-for, in order);
    // offsets the scroll by the sticky game-setup header so the group title isn't hidden under it
    scrollToGroup (idx) {
      const els = this.$refs.groupEl
      if (!els || !els[idx]) return
      const header = document.querySelector('.game-setup-grid .tiles-header')
      const offset = (header ? header.getBoundingClientRect().height : 0) + 6
      const top = els[idx].getBoundingClientRect().top + window.pageYOffset - offset
      window.scrollTo({ top, behavior: 'smooth' })
    },

    // exclude the given tiles from the pack (count 0) — except pre-placed starting tiles,
    // which are kept at their pre-placed count so the game stays creatable
    removeTiles (tiles) {
      if (tiles.length && tiles[0].setKey) {
        // per-set: zero this set's copies (keeping any pre-placed starting tiles)
        tiles.forEach(t => {
          const keep = this.startTileCounts[t.id] || 0
          this.$store.dispatch('gameSetup/setTileOverrideBySet', { setKey: t.setKey, tileId: t.id, count: keep })
        })
        return
      }
      const next = { ...this.storeOverrides }
      tiles.forEach(t => {
        const keep = this.startTileCounts[t.id] || 0
        if (keep > 0 && this.defaultCounts[t.id] === keep) {
          delete next[t.id] // minimum equals the default — no override needed
        } else {
          next[t.id] = keep
        }
      })
      this.$store.dispatch('gameSetup/setTileOverrides', next)
    }
  }
}
</script>

<style lang="sass" scoped>
.distribution-controls
  display: flex
  align-items: center
  gap: 24px
  margin: 0 2px 8px

  .v-input
    margin-top: 0
    padding-top: 0

.pack-actions
  display: flex
  gap: 8px
  margin: 0 2px 10px

  &.group-actions
    justify-content: center
    margin: 0 0 8px

.group-title
  display: flex
  align-items: center
  gap: 8px
  justify-content: center
  font-weight: 300
  font-size: 20px
  margin: 14px 0 6px

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

  .group-symbol
    width: 28px
    height: 28px

    +theme using ($theme)
      fill: map-get($theme, 'cards-text')

  .group-nav
    display: inline-flex
    gap: 2px
    margin-left: 6px

.tile-distribution
  display: flex
  flex-wrap: wrap
  justify-content: flex-start

  svg, .miniboard
    display: block
    margin: 0 2px

  .tile.excluded
    svg
      opacity: 0.35

  .count
    text-align: center
    padding: 4px 0
    margin-bottom: 10px
    font-weight: 300
    font-size: 26px
    line-height: 1.2

  // keep the stepper no wider/taller than the plain count line, so the grid layout
  // stays identical whether quantity editing is on or off (same font, same line box)
  .count.stepper
    display: flex
    align-items: center
    justify-content: center
    gap: 0
    max-width: 100%
    overflow: hidden

    .v-btn
      flex: 0 0 auto

    .stepper-count
      min-width: 30px
      text-align: center
      line-height: 1.2

  &.small .count
    font-size: 18px
    margin-bottom: 3px
    padding: 0
</style>
