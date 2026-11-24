<template>
  <v-card>
    <v-card-title class="headline">
      {{ $t('game.tile-pack-dialog.tiles') }}
      <div  v-if="!options.puristTiles && started" class="switch-wrapper">
        <v-switch
          v-model="showAvailableOnly"
          dense
          hide-details
          :label="$t('core-messages.show-available-only')"
        />
      </div>
    </v-card-title>
    <v-card-text>
      <template v-if="removedTiles && removedTiles.length">
        <h2>{{ $t('game.tile-pack-dialog.discarded-tiles') }}</h2>
        <div class="removed-tiles-list">
          <!-- crossed out: a discarded tile is out of the game (the history marks it the same way,
               in the same colour) -->
          <div
            v-for="(id, idx) in removedTiles"
            :key="idx"
            class="tile discarded"
          >
            <StandaloneTileImage
              :tile-id="id"
              :size="100"
            />
            <v-icon class="discarded-mark">fas fa-times</v-icon>
          </div>
        </div>
      </template>

      <!-- not started yet (the open game / take a slot page): the game's tiles, nothing drawn -->
      <template v-if="!started">
        <h2>{{ $t('game.tile-pack-dialog.game-tiles') }}</h2>
        <TileDistributionLive :sets="sets" :rules="rules" :remaining="false" />
      </template>
      <template v-else-if="options.puristTiles">
        <h2>{{ $t('game.tile-pack-dialog.game-tiles') }}</h2>
        <p>{{ $t('game.tile-pack-dialog.disabled-show-remaining') }}</p>
        <TileDistributionLive :sets="sets" :rules="rules" :remaining="false" />
      </template>
      <template v-else>
        <h2>{{ $t('game.tile-pack-dialog.remaining-tiles') }}</h2>

        <div
          v-if="underHills"
          class="hills-info"
        >
          <img src="~/assets/features/C1/hill.png" height="55">
          <p>
            {{ $tc('game.tile-pack-dialog.hidden-tiles-under-hill-plural', underHills) }}
          </p>
        </div>
        <TileDistributionLive :sets="sets" :rules="rules" :remaining="true" :available-only="showAvailableOnly" />
      </template>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        text
        @click="$emit('close')"
      >{{ $t('button.close') }}</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { mapState } from 'vuex'

import TileDistributionLive from '@/components/game/dialogs/TileDistributionLive'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'

export default {
  components: {
    StandaloneTileImage,
    TileDistributionLive
  },

  props: {
  },

  data () {
    return {
      showAvailableOnly: false
    }
  },

  computed: {
    ...mapState({
      sets: state => state.game.setup?.sets,
      rules: state => state.game.setup?.rules,
      removedTiles: state => state.game.discardedTiles,
      options: state => state.game.setup.options || {},
      // no tile pack before the game starts (the open game page opens this dialog too)
      started: state => !!state.game.tilePack,
      underHills: state => state.game.tilePack?.underHills
    })
  }
}

</script>

<style lang="sass" scoped>
h2
  font-weight: 300
  font-size: 16px
  text-transform: uppercase
  text-align: center
  margin: 10px 0

  +theme using ($theme)
    color: map-get($theme, 'gray-text-color')

.removed-tiles-list
  display: flex
  flex-wrap: wrap

  svg
    margin: 0 2px

  .tile.discarded
    position: relative

  // a big X over the whole tile
  .discarded-mark
    position: absolute
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)
    font-size: 96px
    pointer-events: none
    opacity: 0.85
    // a black border around the X, so it reads on light and dark tiles alike. Drop-shadows in four
    // directions draw it OUTSIDE the glyph (-webkit-text-stroke would eat into the thin strokes,
    // and paint-order for HTML text needs a newer Chromium than Electron 21's)
    filter: drop-shadow(2px 0 0 #000) drop-shadow(-2px 0 0 #000) drop-shadow(0 2px 0 #000) drop-shadow(0 -2px 0 #000)

    +theme using ($theme)
      color: map-get($theme, 'removed-color')

p
  text-align: center
  margin-top: 10px
  font-style: italic

.hills-info
  display: flex
  align-items: center
  margin-bottom: 20px
  padding: 10px 20px
  border-radius: 6px

  +theme using ($theme)
    background-color: map-get($theme, 'board-bg')

  img
    margin-right: 40px

  p
    font-size: 18px
    margin: 0

.headline
  position: relative

.switch-wrapper
  position: absolute
  top: 14px
  right: 50px
  font-size: 14px
  font-weight: normal
  letter-spacing: normal

  .v-input
    margin: 0
</style>
