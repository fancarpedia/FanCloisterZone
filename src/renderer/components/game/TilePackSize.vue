<template>
  <section class="tile-pack-size">
    <v-icon>fas fa-layer-group</v-icon>
    <span class="size"><span class="cca" v-if="setupPhase">≈</span>{{ size }}</span>
    <div v-if="removedTilesSize" class="removed-tiles">
      <div class="ico-wrapper">
        <v-icon>fas fa-square</v-icon>
        <v-icon class="times">fas fa-times</v-icon>
      </div>
      <span>{{ removedTilesSize }}</span>
    </div>
    <div v-if="gameKey" class="game-key" :title="$t('index.online.game-id')">{{ gameKey }}</div>
  </section>
</template>

<script>
export default {
  props: {
    setupPhase: { type: Boolean, default: false },
    size: { type: Number, required: true },
    removedTilesSize: { type: Number, default: 0 },
    // online game key (e.g. "ABC-123") shown under the deck counter
    gameKey: { type: String, default: null }
  }
}
</script>

<style lang="sass" scoped>
section
  display: flex
  justify-content: center
  align-items: center
  position: relative
  user-select: none

.v-icon, .size
  font-size: 42px

.size
  font-weight: bold
  margin-left: $panel-gap

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')
    
.cca
  font-weight: normal
  padding-right: 0.25ex

.game-key
  position: absolute
  left: 0
  right: 0
  bottom: -14px
  text-align: center
  font-size: 13px
  font-weight: 300
  letter-spacing: 1px

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

// the discarded tiles: top-right corner — the bottom row belongs to the game code
.removed-tiles
  position: absolute
  display: flex
  justify-content: center
  align-items: center
  right: 6px
  top: 4px

  .v-icon, span
    font-size: 24px

    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

  span
    font-weight: bold
    margin-left: 4px

  // a tile (square) with a cross centred on it, the cross ~60% of the square at any size
  .ico-wrapper
    position: relative
    display: inline-flex

    .times
      font-size: 14px
      position: absolute
      left: 50%
      top: 50%
      transform: translate(-50%, -50%)
      color: white !important

@media (max-height: 768px)
  .v-icon, .size
    font-size: 28px

  .removed-tiles
    top: 2px

    .v-icon, span
      font-size: 16px

    .ico-wrapper .times
      font-size: 9px
</style>
