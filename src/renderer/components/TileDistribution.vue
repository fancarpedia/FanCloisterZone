<template>
  <div class="tile-distribution-wrap">
    <div v-if="editable" class="distribution-controls">
      <v-checkbox
        v-model="separateExpansions"
        :label="$t('game-setup.separate-expansions')"
        dense hide-details
      />
      <v-checkbox
        v-model="quantityChange"
        :label="$t('game-setup.enable-quantity-change')"
        dense hide-details
      />
    </div>

    <!-- global actions only in the flat view — the separated view has them per expansion -->
    <div v-if="quantityEditActive && !separateExpansions" class="pack-actions">
      <v-btn small outlined :disabled="!hasAnyOverride" @click="resetTiles()">
        {{ $t('game-setup.reset-tiles') }}
      </v-btn>
      <v-btn small outlined :disabled="allTilesRemoved(tileItems)" @click="removeTiles(tileItems)">
        {{ $t('game-setup.remove-all-tiles') }}
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
          <v-btn icon x-small :disabled="gi === 0" :title="$t('game-setup.previous-expansion')" @click="scrollToGroup(gi - 1)">
            <v-icon x-small>fa-chevron-up</v-icon>
          </v-btn>
          <v-btn icon x-small :disabled="gi >= displayGroups.length - 1" :title="$t('game-setup.next-expansion')" @click="scrollToGroup(gi + 1)">
            <v-icon x-small>fa-chevron-down</v-icon>
          </v-btn>
        </span>
      </h3>

      <div v-if="quantityEditActive && group.title !== null && group.tiles.length" class="pack-actions group-actions">
        <v-btn x-small outlined :disabled="!hasGroupOverride(group.tiles)" @click="resetTiles(group.tiles)">
          {{ $t('game-setup.reset-tiles') }}
        </v-btn>
        <v-btn x-small outlined :disabled="allTilesRemoved(group.tiles)" @click="removeTiles(group.tiles)">
          {{ $t('game-setup.remove-all-tiles') }}
        </v-btn>
      </div>

      <div class="tile-distribution" :class="{ small }">
        <div
          v-for="{ id, count, rotation, cap } in group.tiles"
          :key="id"
          class="tile"
          :class="{ excluded: count === 0 }"
          :style="{ width: `${tileSize + 4}px` }"
        >
          <StandaloneTileImage
            :tile-id="id"
            :size="tileSize"
            :rotation="rotation"
            @click.native="onTileClick(id, count)"
          />
          <div v-if="!quantityEditActive" class="count">{{ count }}</div>
          <div v-else class="count stepper">
            <v-btn icon x-small :disabled="count <= 0" @click="changeCount(id, count, -1)">
              <v-icon x-small>fa-minus</v-icon>
            </v-btn>
            <span class="stepper-count">{{ count }}</span>
            <v-btn icon x-small :disabled="count >= cap" @click="changeCount(id, count, 1)">
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
    editable: { type: Boolean, default: false }
  },

  data () {
    return {
      separateExpansions: false,
      quantityChange: false
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
      storeOverrides: state => state.gameSetup.tileOverrides
    }),

    quantityEditActive () {
      return this.editable && this.quantityChange
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

    // one flat pseudo-group, or (editable + separate view) a group per expansion
    displayGroups () {
      if (!this.editable || !this.separateExpansions) {
        return [{
          id: 'all',
          title: null,
          expansion: null,
          total: this.tileItems.reduce((sum, t) => sum + t.count, 0),
          tiles: this.tileItems,
          miniboard: !!this.sets.count
        }]
      }

      // map each tile id to the (first) selected expansion providing it, then distribute
      // the already-sorted tileItems so per-group tile order matches the flat view
      const tileExpansion = {}
      const expansionOrder = []
      const expansions = this.$tiles.getExpansions(this.baseSets, this.edition)
      Object.keys(expansions).forEach(expId => {
        const expansion = Expansion[expId]
        if (!expansion) return
        expansionOrder.push(expId)
        expansion.releases.forEach(release => {
          release.sets.forEach(sid => {
            const set = this.$tiles.sets[sid] || this.$tiles.sets[sid + ':' + this.edition]
            if (!set) return
            if (!this.baseSets[sid] && !this.baseSets[sid + ':' + this.edition]) return
            Object.keys(set.tiles).forEach(tileId => {
              if (tileExpansion[tileId] === undefined) {
                tileExpansion[tileId] = expId
              }
            })
          })
        })
      })

      const byExpansion = {}
      const rest = []
      this.tileItems.forEach(t => {
        const expId = tileExpansion[t.id]
        if (expId === undefined) {
          rest.push(t)
          return
        }
        if (!byExpansion[expId]) byExpansion[expId] = []
        byExpansion[expId].push(t)
      })

      const groups = []
      expansionOrder.forEach(expId => {
        const tiles = byExpansion[expId]
        if (!tiles || !tiles.length) return
        const expansion = Expansion[expId]
        groups.push({
          id: expId,
          title: this.expansionTitle(expansion),
          expansion,
          total: tiles.reduce((sum, t) => sum + t.count, 0),
          tiles,
          miniboard: false
        })
      })

      // tiles not claimed by any expansion (safety net) keep a residual group
      if (rest.length) {
        groups.push({
          id: '_rest',
          title: '…',
          expansion: null,
          total: rest.reduce((sum, t) => sum + t.count, 0),
          tiles: rest,
          miniboard: false
        })
      }
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

    // clicking a removed (count 0) tile brings it back with a single copy
    onTileClick (tileId, count) {
      if (this.quantityEditActive && count === 0) {
        this.changeCount(tileId, 0, 1)
        return
      }
      this.$emit('tile-click', tileId, count)
    },

    changeCount (tileId, count, delta) {
      const next = Math.min(Math.max(count + delta, 0), this.caps[tileId])
      if (next === count) return
      this.$store.dispatch('gameSetup/setTileOverride', { tileId, count: next })
    },

    hasGroupOverride (tiles) {
      if (!this.storeOverrides) return false
      return tiles.some(t => this.storeOverrides[t.id] !== undefined)
    },

    allTilesRemoved (tiles) {
      // "removed" = at the minimum count (0, or the kept count for pre-placed starting tiles)
      return tiles.length > 0 && tiles.every(t => t.count === (this.startTileCounts[t.id] || 0))
    },

    // restore defaults — for all tiles (no argument) or for the given group's tiles only
    resetTiles (tiles = null) {
      if (tiles === null) {
        this.$store.dispatch('gameSetup/setTileOverrides', {})
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
