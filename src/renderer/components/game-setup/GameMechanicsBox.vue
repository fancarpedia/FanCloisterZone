<template>
  <div
    v-if="!hideOnWeb"
    :class="{
      'game-mechanics-box': true,
      'disabled': !enabled,
      'mandatory': mandatory,
      'selected': selected,
    }"
    @click.stop="toggle"
  >
    <!-- the AI plays this (utils/ai-support.js): AI players stay available with it -->
    <div v-if="aiPlayable" class="ai-badge" :title="$t('game-setup.ai.supported')">
      <v-icon small>fa-solid fa-robot</v-icon>
    </div>
    <!-- "i": the tiles carrying it (like the tile-set box's tiles icon) — never toggles the box -->
    <a href="#" class="detail-link" :title="$t('game-setup.rules.info-title')" @click.stop.prevent="infoOpen = true">
      <v-icon>fas fa-circle-info</v-icon>
    </a>
    <v-dialog v-model="infoOpen" max-width="800">
      <FeatureInfoDialog v-if="infoOpen" :feature-id="featureId" @close="infoOpen = false" />
    </v-dialog>
    <div class="box-title">
      <slot name="icon" />
      <h3>{{ $t(featureTitleKey(featureId)) }}</h3>
    </div>
    <div class="toggle">
      <div v-if="selected"><v-icon>fas fa-check</v-icon></div>
      <div v-else-if="enabled" class="add-first">{{ $t('button.set') }}</div>
      <div v-else class="disabled-message">
        <slot name="disabled" />
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { isWeb } from '@/utils/version'
import { isAiElement } from '@/utils/ai-support'
import FeatureInfoDialog from '@/components/game-setup/FeatureInfoDialog'
import { featureTitleKey } from '@/utils/feature-title'

export default {
  components: {
    FeatureInfoDialog
  },

  props: {
    item: { type: Object, default: null },
    mutable: { type: Boolean, default: true },
    // a base feature every game has (road, city, monastery): no element behind it — always on,
    // cannot be switched off; the id names it (game.feature.<id>)
    fixedFeature: { type: String, default: null }
  },

  data () {
    return { infoOpen: false }
  },

  computed: {
    featureId () {
      return this.fixedFeature || this.item.id
    },

    aiPlayable () {
      return !!this.fixedFeature || isAiElement(this.item)
    },

    ...mapState({
      sets: state => state.gameSetup.sets,
      // null until the setup store is initialised; a reload can re-mount this first
      elements: state => state.gameSetup.elements || {},
      tileOverrides: state => state.gameSetup.tileOverrides
    }),

    // Mechanics not offered when creating a game in the web build (flagged notOnWeb in elements.js).
    hideOnWeb () {
      return !this.fixedFeature && isWeb() && !!this.item.notOnWeb
    },

    enabled () {
      if (this.fixedFeature) return true
      return this.$tiles.isElementEnabled(this.item, this.sets, this.elements, this.tileOverrides, this.elements.garden ? 2 : 1)
    },

    mandatory () {
      return !!this.fixedFeature || (!this.mutable && this.enabled)
    },

    selected () {
      return !!this.fixedFeature || !!this.elements[this.item.id]
    }
  },

  methods: {
    featureTitleKey,

    toggle () {
      if (this.enabled && !this.mandatory) {
        this.$store.dispatch('gameSetup/setElementConfig', { id: this.item.id, config: !this.selected })
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.game-mechanics-box
  display: flex
  flex-direction: column
  cursor: pointer
  position: relative
  // "the AI plays this" — top-left corner, out of the way of the corner controls on the right

  .ai-badge
    position: absolute
    top: 9px
    left: 11px
    z-index: 1
    line-height: 1
    cursor: default

    // the robot in the box's own text colour
    .v-icon
      color: inherit !important

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: map-get($theme, 'cards-bg')

  // "i" — top-right corner, as the tile-set box's tiles icon
  .detail-link
    position: absolute
    top: 0
    right: 0
    z-index: 1
    text-decoration: none
    cursor: pointer

    .v-icon
      font-size: 24px
      margin: 8px
      transition: none !important

      +theme using ($theme)
        color: map-get($theme, 'link-detail-color')

    &:hover .v-icon
      +theme using ($theme)
        color: map-get($theme, 'text-color')

  .box-title
    text-align: center
    height: 136px
    padding: 24px 0 8px 0
    line-height: 1

    h3
      font-size: 1.09em
      font-weight: 300
      margin-top: 16px

    img, svg
      display: block
      opacity: 0.9
      filter: grayscale(100%)
      border: 0
      margin: 0 auto

  .toggle
    flex: 1
    display: flex
    flex-direction: column
    justify-content: center
    text-align: center
    min-height: 56px

    // TODO make mixin from it
    .add-first
      font-size: 16px
      text-transform: uppercase
      font-weight: 300

      +theme using ($theme)
        color: map-get($theme, 'gray-text-color')

    &:hover .add-first
      text-decoration: underline

      +theme using ($theme)
        color: map-get($theme, 'cards-link-hover')

  &.selected
    +theme using ($theme)
      background: map-get($theme, 'cards-selected-bg')
      box-shadow: map-get($theme, 'cards-selected-shadow')

    h3
      +theme using ($theme)
        color: map-get($theme, 'cards-selected-text')

    .box-title
      img, svg
        opacity: 1
        filter: none
        display: block

  // always on (a base feature, or forced by the setup): nothing to click
  &.mandatory, &.mandatory .toggle
    cursor: default

  &.disabled
    background: transparent
    cursor: default

    .box-title
      opacity: $rules-disabled-opacity

    .toggle
      cursor: default
      border-color: rgba(0, 0, 0, 0.05)

  // match the hover message styling of QuantityButtons (Extra Figures boxes) — themed
  // color so it is visible in dark mode too
  .disabled-message
    visibility: hidden
    font-size: 12px
    text-transform: uppercase
    font-weight: 300
    padding: 0 6px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

.game-mechanics-box:hover
  .disabled-message
    visibility: visible
</style>
