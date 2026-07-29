<template>
  <div
    class="final-stats"
  >
    <div class="grid-wrap" :style="`width: ${width}px`">
      <div class="grid summary" :style="cols">
        <div />
        <!-- coop: no ranking — the whole team wins or loses together -->
        <div v-for="p in players" :key="'rank-'+p.index" class="rank">
          <template v-if="coop">{{ coop.lost ? '💔' : '🏆' }}</template>
          <template v-else-if="p.rank == 1">🥇</template>
          <template v-else-if="p.rank == 2">🥈</template>
          <template v-else-if="p.rank == 3">🥉</template>
          <template v-else>{{ p.rank }}</template>
        </div>

        <div />
        <div
          v-for="p in players"
          :key="'ico-'+p.index"
          :class="colorCssClass(p.index)"
        >
          <Meeple type="SmallFollower" />
        </div>

        <div />
        <div v-for="p in players" :key="'name-'+p.index" class="name">
          {{ p.name }}<v-icon v-if="p.ai">fa-solid fa-robot</v-icon>
        </div>

        <div />
        <div v-for="p in players" :key="'points-'+p.index" class="points" :class="colorCssClass(p.index)">
          <div>
            {{ p.points }}
          </div>
        </div>

        <div class="header tiles" :title="$t('game.feature.placed-tiles')">
          <ScoringIcon name="tiles" :size="42" />
          <div class="header-label">
            <div class="header-title">{{ $t('game.feature.placed-tiles') }}</div>
          </div>
        </div>
        <div v-for="(val, idx) in stats.tiles" :key="'tiles-'+idx" class="tiles value">
          {{ val }}
        </div>
      </div>

      <div
        v-for="cat in categories"
        :key="cat.name"
        class="grid category"
        :class="{ 'has-items': cat.items.length }"
        :style="cols"
      >
        <div class="header" :title="$t(cat.title)">
          <ScoringIcon :name="cat.name" :size="40" />
          <div class="header-label">
            <div class="header-title">{{ $t(cat.title) }}</div>
          </div>
        </div>
        <div
          v-for="(val, idx) in stats.points[cat.name]"
          :key="cat.name + '-' + idx"
          class="value"
        >
          {{ val }}
        </div>

        <template v-for="item in cat.items">
          <div :key="cat.name + '-' + item.name + '-h'" class="header item-header">
            <div class="item-icon">
              <ScoringIcon v-if="itemIcon(item.name)" :name="itemIcon(item.name)" :size="40" />
              <ExpressionItem v-else :item="{ name: item.name }" icon-only />
            </div>
            <div class="header-label">
              <div class="header-subtitle">{{ itemLabel(item.name) }}</div>
            </div>
          </div>
          <div
            v-for="(val, idx) in item.points"
            :key="cat.name + '-' + item.name + '-' + idx"
            class="value item-value"
          >
            {{ val }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

import flatten from 'lodash/flatten'
import debounce from 'lodash/debounce'

import ExpressionItem from '@/components/game/ExpressionItem'
import Meeple from '@/components/game/Meeple'
import ScoringIcon from '@/components/game/ScoringIcon'

// scoring categories in display order; `always` ones show even at 0 points, the rest only
// when scored. Each row shows the category total plus a sub-row per contributing item.
const CATEGORIES = [
  { name: 'road', title: 'game.feature.roads', always: true },
  { name: 'city', title: 'game.feature.cities', always: true },
  { name: 'monastery', title: 'game.feature.monasteries', always: true },
  { name: 'garden', title: 'game.feature.gardens', always: true },
  { name: 'field', title: 'game.feature.fields', always: true },
  { name: 'special-monastery', title: 'game.feature.special-monasteries' },
  { name: 'castle', title: 'game.feature.castles', explode: true },
  { name: 'watchtower', title: 'game.feature.watchtowers', explode: true },
  { name: 'trade-goods', title: 'game.feature.trade-goods' },
  { name: 'shrine', title: 'game.feature.shrines' },
  { name: 'king', title: 'core-messages.the-biggest-city' },
  { name: 'robber', title: 'core-messages.the-longest-road' },
  { name: 'gold', title: 'game.feature.gold' },
  { name: 'fairy', title: 'game.feature.fairy', explode: true },
  { name: 'black-fairy', title: 'game.feature.black-fairy', explode: true },
  { name: 'tower', title: 'game.feature.towers' },
  { name: 'flock', title: 'game.feature.sheep' },
  { name: 'ringmaster', title: 'game.feature.ringmaster' },
  { name: 'bigtop', title: 'game.feature.big-top' },
  { name: 'acrobats', title: 'game.feature.acrobats' },
  { name: 'wind-rose', title: 'game.feature.wind-roses' },
  { name: 'church', title: 'game.feature.church-bonus' },
  { name: 'yaga-hut', title: 'game.feature.yaga-hut' },
  { name: 'vodyanoy', title: 'game.feature.vodyanoy' },
  { name: 'flowers', title: 'game.feature.flowers', explode: true },
  { name: 'obelisk', title: 'game.element.obelisk' },
  { name: 'windmill', title: 'game.element.windmill' },
  { name: 'decinsky-sneznik', title: 'game.element.decinsky-sneznik' },
  { name: 'river', title: 'game.feature.fishermen' },
  { name: 'courier', title: 'game.figure.courier', explode: true },
  { name: 'fishhut', title: 'game.feature.fishhut' }
]

export default {
  components: {
    ExpressionItem,
    Meeple,
    ScoringIcon
  },

  data () {
    return {
      width: 0
    }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass',
      ranks: 'game/ranks'
    }),

    ...mapState({
      history: state => state.game.history,
      coop: state => state.game.coop
    }),

    players () {
      // coop: keep seating order — points are team contributions, not a competition
      if (this.coop) {
        return this.$store.state.game.players.map((p, index) => ({ ...p, index, rank: null }))
      }
      return flatten(this.ranks.map(r => r.players.map(p => ({ ...p, rank: r.rank }))))
    },

    cols () {
      return `grid-template-columns: 60px repeat(${this.players.length}, 1fr)`
    },

    stats () {
      const stats = {
        clock: (new Array(this.players.length)).fill('0:00'),
        tiles: (new Array(this.players.length)).fill(0),
        points: {
          'road': (new Array(this.players.length)).fill(0),
          'city': (new Array(this.players.length)).fill(0),
          'monastery': (new Array(this.players.length)).fill(0),
          'garden': (new Array(this.players.length)).fill(0),
          'field': (new Array(this.players.length)).fill(0),
          'special-monastery': (new Array(this.players.length)).fill(0),
          'castle': (new Array(this.players.length)).fill(0),
          'watchtower': (new Array(this.players.length)).fill(0),
          'trade-goods': (new Array(this.players.length)).fill(0),
          'robber': (new Array(this.players.length)).fill(0),
          'king': (new Array(this.players.length)).fill(0),
          'gold': (new Array(this.players.length)).fill(0),
          'fairy': (new Array(this.players.length)).fill(0),
          'black-fairy': (new Array(this.players.length)).fill(0),
          'tower': (new Array(this.players.length)).fill(0),
          'flock': (new Array(this.players.length)).fill(0),
          'ringmaster': (new Array(this.players.length)).fill(0),
          'bigtop': (new Array(this.players.length)).fill(0),
          'acrobats': (new Array(this.players.length)).fill(0),
          'shrine': (new Array(this.players.length)).fill(0),
          'wind-rose': (new Array(this.players.length)).fill(0),
          'church': (new Array(this.players.length)).fill(0),
          'yaga-hut': (new Array(this.players.length)).fill(0),
          'vodyanoy': (new Array(this.players.length)).fill(0),
          'flowers': (new Array(this.players.length)).fill(0),
          'marketplace': (new Array(this.players.length)).fill(0),
          'obelisk': (new Array(this.players.length)).fill(0),
          'windmill': (new Array(this.players.length)).fill(0),
          'decinsky-sneznik': (new Array(this.players.length)).fill(0),
          'river': (new Array(this.players.length)).fill(0),
          'courier': (new Array(this.players.length)).fill(0),
          'fishhut': (new Array(this.players.length)).fill(0)
        },
        // per-category item breakdown: { category: { itemName: [pointsPerPlayer] } }
        items: {}
      }
      const addItem = (cat, itName, idx, points) => {
        if (!stats.items[cat]) stats.items[cat] = {}
        if (!stats.items[cat][itName]) {
          stats.items[cat][itName] = (new Array(this.players.length)).fill(0)
        }
        stats.items[cat][itName][idx] += points
      }
      // the scored feature behind a points pointer (plain FeaturePointer, MeeplePointer or
      // ScoreMeeplePositionsPointer) — e.g. "City", "Road", "Windmill"
      const featureOf = ptr => {
        if (!ptr) return null
        if (ptr.feature) return ptr.feature
        if (ptr.featurePointer) return featureOf(ptr.featurePointer)
        if (ptr.pointer) return featureOf(ptr.pointer)
        return null
      }
      this.history.forEach(h => {
        h.events.forEach(ev => {
          if (ev.type === 'tile-placed') {
            const idx = this.players.findIndex(p => p.index === h.player)
            stats.tiles[idx] += 1
          } else if (ev.type === 'ransom-paid') {
            const jailerIdx = this.players.findIndex(p => p.index === ev.jailer)
            stats.points.tower[jailerIdx] += 3
            addItem('tower', 'ransompaid.income', jailerIdx, 3)
            const prisonerIdx = this.players.findIndex(p => p.index === ev.prisoner)
            stats.points.tower[prisonerIdx] -= 3
            addItem('tower', 'ransompaid.payment', prisonerIdx, -3)
          } else if (ev.type === 'points') {
            ev.points.forEach(({ name, player, points, items, ptr }) => {
              const cat = name.split('.')[0]
              const idx = this.players.findIndex(p => p.index === player)
              if (stats.points[cat]) {
                stats.points[cat][idx] += points
                if (cat === 'fairy' || cat === 'black-fairy') {
                  // (black-)fairy.turn (turn start) vs .completed (scored-feature bonus)
                  addItem(cat, name, idx, points)
                } else if (cat === 'courier') {
                  // courier.<feature expression> — group by the scored feature
                  addItem(cat, 'feature.' + (name.split('.')[1] || 'other'), idx, points)
                } else if (cat === 'flowers') {
                  // flowers bonus — group by the feature/figure it was earned on
                  const feature = featureOf(ptr)
                  addItem(cat, 'feature.' + (feature ? feature.toLowerCase() : 'other'), idx, points)
                } else {
                  // accumulate the item-level breakdown (tiles / pennants / cathedral / ...)
                  ;(items || []).forEach(it => {
                    // the engine emits one item per marketplace-adjoining road (marketplace.0,
                    // marketplace.1, …) — collapse them into a single "marketplace" breakdown row
                    const itName = it.name.startsWith('marketplace.') ? 'marketplace' : it.name
                    addItem(cat, itName, idx, it.points)
                  })
                }
              }
            })
          }
        })
      })
      // console.log(stats)
      return stats
    },

    // visible categories (always-shown + scored optional ones), each with its ordered,
    // non-zero item breakdown rows
    categories () {
      const s = this.stats
      return CATEGORIES
        // Keep Building (coop) is played without field scoring — never show the fields row
        .filter(c => !(this.coop && c.name === 'field'))
        .filter(c => c.always || s.points[c.name].some(p => p))
        .map(c => {
          const items = Object.entries(s.items[c.name] || {})
            .filter(([, pts]) => pts.some(p => p))
            .map(([name, points]) => ({ name, points }))
          return {
            name: c.name,
            title: c.title,
            // a single breakdown row usually just duplicates the category total, so the
            // breakdown shows only with 2+ items — except `explode` categories (castle,
            // watchtower, fairy, flowers, courier), whose sub-rows carry extra meaning
            // (which feature/source scored) and are always shown
            items: (c.explode || items.length > 1) ? items : []
          }
        })
    }
  },

  mounted () {
    const computeWidth = () => {
      const { width: parentWidth } = this.$parent.$el.getBoundingClientRect()
      const asideWidth = parseInt(getComputedStyle(document.body).getPropertyValue('--aside-width-plus-gap'), 10)
      const maxWidth = parentWidth - asideWidth - 40 // 40px for padding
      const width = 60 + this.players.length * 200
      this.width = Math.min(maxWidth, width)
    }
    computeWidth()

    this.resizeObserver = new ResizeObserver(debounce(entries => {
      computeWidth()
    }), 1000)
    this.resizeObserver.observe(this.$parent.$el)
  },

  beforeDestroy () {
    this.resizeObserver.disconnect()
  },

  methods: {
    // ScoringIcon name for a breakdown row, or null to fall back to ExpressionItem
    itemIcon (name) {
      if (name === 'tiles') return 'tiles'
      if (name.startsWith('castle.')) return name.split('.')[1]
      if (name.startsWith('fairy.')) return 'fairy'
      if (name.startsWith('black-fairy.')) return 'black-fairy'
      if (name.startsWith('ransompaid.')) return 'tower'
      if (name.startsWith('feature.')) return name.split('.')[1]
      return null
    },

    // localized subtitle for a breakdown row
    itemLabel (name) {
      if (name === 'fairy.turn' || name === 'black-fairy.turn') return this.$t('game.scoring.turn-start')
      if (name === 'fairy.completed' || name === 'black-fairy.completed') return this.$t('game.scoring.feature-scored')
      if (name === 'ransompaid.income') return this.$t('game.scoring.income')
      if (name === 'ransompaid.payment') return this.$t('game.scoring.payment')
      if (name.startsWith('castle.') || name.startsWith('feature.')) {
        const f = name.split('.')[1]
        if (this.$te('game.feature.' + f)) return this.$t('game.feature.' + f)
        if (this.$te('game.element.' + f)) return this.$t('game.element.' + f)
        return f
      }
      return name
    }
  }
}
</script>

<style lang="sass" scoped>
.final-stats
  --top: calc(var(--action-bar-height) + #{$panel-gap})
  position: absolute
  top: var(--top)
  right: var(--aside-width-plus-gap)
  bottom: $panel-gap
  user-select: none
  overflow: auto

  font-size: 20px
  padding: 5px 20px

  +theme using ($theme)
    background: map-get($theme, 'opaque-bg')

  .grid-wrap
    display: flex
    flex-direction: column
    gap: 5px

  .grid
    display: grid
    justify-items: center
    align-items: center
    grid-gap: 5px 0

    .header
      display: flex
      flex-direction: column
      align-items: center

      svg.meeple, svg.neutral
        +theme using ($theme)
          /* fill: map-get($theme, 'gray-text-color') */

      .header-label
        margin-top: 2px
        text-align: center
        line-height: 1.1

        +theme using ($theme)
          color: map-get($theme, 'gray-text-color')

      .header-title
        font-size: 11px
        font-weight: 600

      .header-subtitle
        font-size: 10px
        opacity: 0.6

    // item breakdown sub-rows: smaller icon and faded smaller value
    .header.item-header
      .item-icon
        transform: scale(0.6)

      .expr-item
        margin-right: 0

    .value.item-value
      font-size: 0.7em
      opacity: 0.7

  // a category that has a sub-feature breakdown is boxed together as one group
  // (neutral tint works in both light and dark themes)
  .grid.category.has-items
    border-radius: 8px
    padding: 4px 0 6px
    grid-gap: 3px 0
    background: rgba(128, 128, 128, 0.1)
    box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.25)

svg.meeple
  width: 40px
  height: 40px
  margin-bottom: -9px

  .v-icon
    font-size: 36px

.rank
  font-weight: 900
  font-size: 48px
  margin: 10px 0 5px

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.name
  font-size: 16px
  text-overflow: ellipsis

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.points
  border-radius: 20px
  width: 76px
  margin: 5px 0 10px

  > div
    font-size: 26px
    text-align: center
    font-weight: 500

.v-icon
  font-size: 12px
  margin-left: 0.5ex
</style>
