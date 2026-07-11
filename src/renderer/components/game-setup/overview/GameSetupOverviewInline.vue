<template>
  <div class="game-setup-overview-inline" :class="sizeClass">
    <!-- game type: standard vs Keep Building (co-op) -->
    <div class="game-type" :class="{ coop: isCoop }">
      {{ isCoop ? $t('game.feature.keep-building') : $t('game-setup.variant.standard') }}
    </div>
    <div class="overview-grid">
      <OverviewExpansionTile
        v-for="({ expansion, id, title, quantity, lang }, idx) in releases"
        :key="'r' + expansion.name + idx"
        :expansion="expansion"
        :title="title"
        :quantity="quantity"
        :z-index="toZindex(idx)"
      />
      <OverviewElementTile
        v-for="([element, value], idx) in additions"
        :key="'a' + element"
        :element="element"
        :value="value"
        :z-index="toZindex(idx + releases.length)"
      />
      <OverviewElementTile
        v-for="([element, value], idx) in removals"
        :key="'r' + element"
        :element="element"
        :value="value"
        :z-index="toZindex(idx + releases.length + additions.length)"
      />
    </div>
  </div>
</template>

<script>
import GameSetupOverviewMixin from '@/components/game-setup/overview/GameSetupOverviewMixin'
import OverviewElementTile from '@/components/game-setup/overview/OverviewElementTile'
import OverviewExpansionTile from '@/components/game-setup/overview/OverviewExpansionTile'

export default {
  components: {
    OverviewElementTile,
    OverviewExpansionTile
  },

  mixins: [GameSetupOverviewMixin],

  props: {
    sets: { type: Object, required: true },
    elements: { type: Object, required: true }
  },

  computed: {
    isCoop () {
      return !!this.elements['keep-building']
    },

    sizeClass () {
      const size = this.configElementsSize
      if (size > 6) {
        return 'small'
      }
      return 'normal'
    }
  },

  methods: {
    toZindex (idx) {
      const row = Math.floor(idx / 9)
      const div = idx % 9
      const rowIdx = div % 2 === 0 ? div / 2 : 5 + Math.floor(div / 2)
      return 99 - (row * 9 + rowIdx)
    }
  }
}
</script>

<style lang="sass" scoped>
.game-setup-overview-inline
  width: 360px

  .game-type
    display: inline-block
    margin-bottom: 4px
    padding: 1px 8px
    border-radius: 8px
    font-size: 12px
    font-weight: 600
    text-transform: uppercase
    letter-spacing: 0.5px
    color: white
    background: #9e9e9e

    &.coop
      background: #009900

  .overview-grid
    display: grid
    grid-template-columns: repeat(6, 60px)
    grid-auto-rows: 70px

  .element-box
    width: 60px
    height: 70px

    ::v-deep
      .symbol
        height: 50px
        min-height: 50px // required for title

        > *
          transform: scale(0.75)

      .quantity
        display: inline-block
        padding: 4px
        color: white
        transform: translateY(-10px)
        border-radius: 2px
        font-size: 18px
        opacity: 0.9

        +theme using ($theme)
          background: map-get($theme, 'overview-tile-quantity')

          &.addition
            background: #009900

          &.removal
            background: #ef0000

      .symbol.name
        font-size: 10px

.game-setup-overview-inline.small
  .overview-grid
    grid-template-columns: repeat(9, 36px)
    grid-auto-rows: 40px
    padding-bottom: 30px

  .element-box
    grid-column-end: span 2

  .element-box:nth-child(9n+5)
    grid-column-end: span 1

  .element-box:nth-child(9n+6)
    grid-column-start: 2
</style>
