<template>
  <!-- The mage and witch ended up on one feature (or a magician tile was placed) and no open city
       or road is left to move them to: the player gives one of them up. Drawn like the abbot
       return (ReturnMeepleItem): the big figure with the return icon over it, in the action
       panel's round item slots. -->
  <section :class="{ local }">
    <span class="text">
      {{ local ? $t('game.action.mage-and-witch-remove-mage-or-witch') : $t('game.action.mage-and-witch-player-must-remove-mage-or-witch') }}
    </span>
    <div
      v-for="fig in figures"
      :key="fig.id"
      class="action-item"
      :title="fig.title"
      @click="select(fig.id)"
    >
      <div class="figure-return" :class="fig.figure">
        <NeutralFigure :figure="fig.figure" :class="{ inactive: !local }" />
        <v-icon class="color-overlay">fas fa-undo</v-icon>
      </div>
    </div>
  </section>
</template>

<script>
import NeutralFigure from '@/components/game/NeutralFigure'
import LayeredItemMixin from '@/components/game/actions/items/LayeredItemMixin.js'

export default {
  components: {
    NeutralFigure
  },

  // the figures are also circled on the board (MeepleLayer's virtual NeutralFigureSelectLayer),
  // where the player may click one directly
  mixins: [LayeredItemMixin],

  props: {
    action: { type: Object, required: true },
    local: { type: Boolean }
  },

  computed: {
    // the board circles stay up for as long as the choice is open (for everyone; only the
    // local player can click them)
    active () {
      return true
    },

    layers () {
      return [['NeutralFigureSelectLayer', {
        options: this.figures.map(f => f.id),
        local: this.local,
        player: this.action.player
      }]]
    },

    // the figures the engine offers (RemoveMageOrWitch options), mage first
    figures () {
      const item = (this.action.items || []).find(i => i.type === 'RemoveMageOrWitch')
      const ids = item && item.options && item.options.length ? item.options : ['mage.1', 'witch.1']
      return [...ids]
        .sort((a, b) => (a.startsWith('mage') ? -1 : 1) - (b.startsWith('mage') ? -1 : 1))
        .map(id => {
          const figure = id.split('.')[0]
          return { id, figure, title: this.$t('game.element.' + figure) }
        })
    }
  },

  mounted () {
    this.$root.$on('neutral-figure.select', this.select)
  },

  beforeDestroy () {
    this.$root.$off('neutral-figure.select', this.select)
  },

  methods: {
    async select (figureId) {
      if (this.local) {
        await this.$store.dispatch('game/apply', {
          type: 'MOVE_NEUTRAL_FIGURE',
          payload: {
            figureId,
            to: null
          }
        })
      }
    }
  }
}
</script>

<style lang="sass" scoped>
section
  display: flex
  align-items: center
  justify-content: center

.text
  font-size: 20px
  font-weight: 300
  margin-right: 20px

// the action panel's round item slot (ActionPhaseAction .action-item)
.action-item
  width: 120px
  height: calc(var(--action-bar-height) + 10px)
  margin: -5px
  display: flex
  justify-content: center
  align-items: center

section.local .action-item
  cursor: pointer

  &:hover
    +theme using ($theme)
      background: rgba(map-get($theme, 'action-panel-hover-bg'), 0.72)
      border-radius: 500px

// the figure with the return icon over it, as the abbot return (ReturnMeepleItem .meeple-return)
.figure-return
  position: relative

  svg
    width: 74px
    height: 74px

    @media (max-height: 768px)
      width: 54px
      height: 54px

  svg.inactive
    fill: #999
    color: white

  i
    position: absolute
    left: calc(50% - 12px)
    top: calc(50%)
    font-size: 24px

@media (max-height: 800px)
  .action-item
    width: 72px
</style>
