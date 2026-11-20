<template>
  <!-- Rules tab "i": an element / base feature — its name (as on the Rules tab box), its
       description when the language pack has one, and the tiles that carry it: how many of them
       are in the chosen pack out of all tile sets' tiles with it -->
  <v-card>
    <v-card-title class="headline">
      {{ $t(featureTitleKey(featureId)) }}
    </v-card-title>
    <v-card-text>
      <!-- how it scores, when that needs saying first (the shrine: like a monastery, but …) -->
      <p v-if="scoring" class="description">{{ scoring }}</p>
      <p v-if="description" class="description">{{ description }}</p>
      <p class="summary">
        {{ $t('game-setup.rules.info-tiles-count', { count: info.count, total: info.total }) }}
      </p>
      <!-- grouped by expansion, as the tile list of the Tile Sets tab -->
      <div v-for="group in groups" :key="group.key" class="group">
        <h3 class="group-title">
          <ExpansionSymbol v-if="group.expansion" :expansion="group.expansion" class="group-symbol" />
          {{ group.title }}&nbsp;({{ group.count }} / {{ group.total }})
        </h3>
        <div class="tile-distribution">
          <div
            v-for="t in group.tiles"
            :key="t.id"
            class="tile"
            :class="{ excluded: t.count === 0 }"
            :style="{ width: `${tileSize + 4}px` }"
          >
            <StandaloneTileImage :tile-id="t.id" :size="tileSize" :rotation="rotation(t.id)" />
            <div class="count">{{ t.count }}<span class="total"> / {{ t.total }}</span></div>
          </div>
        </div>
      </div>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn text @click="$emit('close')">{{ $t('button.close') }}</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { mapState } from 'vuex'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import ExpansionSymbol from '@/components/ExpansionSymbol'
import { Expansion } from '@/models/expansions'
import { getSelectedEdition } from '@/utils/gameSetupUtils'
import { featureTitleKey } from '@/utils/feature-title'

export default {
  components: {
    ExpansionSymbol,
    StandaloneTileImage
  },

  props: {
    // a GameElement id (inn, garden, …) or a base feature (road, city, monastery)
    featureId: { type: String, required: true }
  },

  data () {
    return { tileSize: 90 }
  },

  computed: {
    ...mapState({
      sets: state => state.gameSetup.sets || {},
      tileOverrides: state => state.gameSetup.tileOverrides,
      // as the tile list does (1st / 2nd edition by the garden element)
      edition: state => getSelectedEdition(state.gameSetup.elements) || 1
    }),

    scoring () {
      const key = 'game-setup.rules.' + this.featureId + '-scoring'
      return this.$te(key) ? this.$t(key) : null
    },

    description () {
      const key = 'game-setup.rules.' + this.featureId + '-description'
      return this.$te(key) ? this.$t(key) : null
    },

    // the tiles per expansion: active ones (tiles in the game) first, then by Expansion.all() order
    groups () {
      const order = Expansion.all().map(e => e.name)
      const byExp = {}
      this.info.tiles.forEach(t => {
        const key = t.expansion || '_'
        ;(byExp[key] = byExp[key] || []).push(t)
      })
      return Object.entries(byExp)
        .map(([key, tiles]) => {
          const expansion = Expansion[key] || null
          return {
            key,
            expansion,
            title: expansion ? this.expansionTitle(expansion) : '',
            tiles,
            count: tiles.reduce((sum, t) => sum + t.count, 0),
            total: tiles.reduce((sum, t) => sum + t.total, 0)
          }
        })
        .sort((a, b) => {
          // the expansions with tiles in the current game first, then the rest — each part in
          // the order the expansions are listed
          const active = (b.count > 0) - (a.count > 0)
          if (active) return active
          const ia = order.indexOf(a.key)
          const ib = order.indexOf(b.key)
          return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib)
        })
    },

    info () {
      void this.$store.state.tilesVersion // eslint-disable-line no-void -- re-read after an add-on install
      return this.$tiles.getFeatureTiles(this.featureId, this.sets, this.tileOverrides, this.edition)
    }
  },

  methods: {
    featureTitleKey,

    expansionTitle (expansion) {
      const langId = 'expansion.' + expansion.name.toLowerCase().replace(/_/g, '-')
      return this.$te(langId) ? this.$t(langId) : expansion.title
    },

    rotation (id) {
      return this.$theme.getTile(id)?.rotation || 0
    }
  }
}
</script>

<style lang="sass" scoped>
.description
  font-size: 15px

.summary
  font-weight: 500

.group-title
  display: flex
  align-items: center
  gap: 8px
  font-weight: 300
  font-size: 18px
  margin: 14px 0 6px

  .group-symbol
    width: 26px
    height: 26px

    +theme using ($theme)
      fill: map-get($theme, 'cards-text')

.tile-distribution
  display: flex
  flex-wrap: wrap
  justify-content: flex-start

  svg
    display: block
    margin: 0 2px

  .tile.excluded svg
    opacity: 0.35

  .count
    text-align: center
    padding: 4px 0
    margin-bottom: 10px
    font-weight: 300
    font-size: 22px
    line-height: 1.2

    .total
      font-size: 15px
      opacity: 0.6
</style>
