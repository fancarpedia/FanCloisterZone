<template>
  <div
    v-if="!hideOnWeb"
    :class="{
      'element-box': true,
      'disabled': !enabled || !!blockedReason,
      'mandatory': mandatory,
      'selected': selected,
    }"
  >
    <!-- Keep Building (coop variant): mark the figures that count for the
         enlarge-or-occupy obligation while the variant is selected -->
    <div
      v-if="item.keepBuildingMeeple && coopVariant"
      class="keep-building-badge"
      :title="$t('game.feature.keep-building')"
    >
      🤝
    </div>
    <GameElementButtons
      :mutable="mutable && enabled && !blockedReason"
      :item="item"
      :max="max"
      :min="min"
      :reset="reset"
      :show-number="showNumber"
      :default-value="defaultValue"
    >
      <div class="box-title">
        <slot />
        <h3>{{ $t(['game.element',item.id].join('.')) }}</h3>
      </div>

      <template v-if="blockedReason" #hover>
        <div class="text text-disabled">{{ blockedReason }}</div>
      </template>

      <template v-else-if="!enabled" #hover>
        <div class="text text-disabled">{{ $t('game-setup.game-element-box.related-tiles-not-selected') }}</div>
      </template>

      <template v-else-if="mandatory" #hover>
        <div class="text text-mandatory">{{ $t('game-setup.game-element-box.mandatory-for-selected-tiles') }}</div>
      </template>
    </GameElementButtons>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { isWeb } from '@/utils/version'
import GameElementButtons from '@/components/game-setup/buttons/GameElementButtons'

export default {
  components: {
    GameElementButtons
  },

  props: {
    item: { type: Object, required: true },
    mutable: { type: Boolean, default: true },
    min: { type: Number, default: 1 },
    max: { type: Number, default: 1 },
    reset: { type: Number, default: null },
    blockedReason: { type: String, default: null },
    showNumber: { type: Boolean, default: false },
    defaultValue: { type: Number, default: null }
  },

  computed: {
    ...mapState({
      sets: state => state.gameSetup.sets,
      elements: state => state.gameSetup.elements,
      tileOverrides: state => state.gameSetup.tileOverrides
    }),

    // Some components (Tower, Abbey, Tunnel, Ferry, Gold, …) are not offered when creating a game
    // in the web build. Flagged notOnWeb in models/elements.js.
    hideOnWeb () {
      return isWeb() && !!this.item.notOnWeb
    },

    coopVariant () {
      return !!this.elements['keep-building']
    },

    enabled () {
      return this.$tiles.isElementEnabled(this.item, this.sets, this.elements, this.tileOverrides, this.elements.garden ? 2 : 1)
    },

    mandatory () {
      return !this.mutable && this.enabled
    },

    selected () {
      return !!this.elements[this.item.id]
    }
  }
}
</script>

<style lang="sass" scoped>
.element-box
  display: flex
  flex-direction: column
  position: relative

  .keep-building-badge
    position: absolute
    top: 4px
    right: 6px
    z-index: 1
    font-size: 20px
    line-height: 1
    padding: 3px
    border-radius: 50%
    background: rgba(0, 153, 0, 0.18) // same green family as the coop type badge
    cursor: default

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: map-get($theme, 'cards-bg')

  ::v-deep .box-title
    text-align: center
    height: 136px
    padding: 24px 0 8px 0

    h3
      font-size: 1.09em
      font-weight: 300
      margin-top: 16px

    img
      display: block
      opacity: 0.9
      filter: grayscale(100%)
      border: 0
      margin: 0 auto

  &.selected
    +theme using ($theme)
      background: map-get($theme, 'cards-selected-bg')
      box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.15), 0 3px 10px 0 rgba(0, 0, 0, 0.10)

    h3
      +theme using ($theme)
        color: map-get($theme, 'cards-selected-text')

    ::v-deep .box-title img
      opacity: 1
      filter: none
      display: block

.element-box.disabled
  ::v-deep .box-title svg
    opacity: 0.16
</style>
