<template>
  <span v-if="icon" class="scoring-icon">
    <StandaloneTileImage v-if="icon.kind === 'tile'" :tile-id="icon.value" :size="iconSize" />
    <img v-else-if="icon.kind === 'tile-back'" class="tile-back" :src="icon.value" :width="iconSize" :height="iconSize">
    <img v-else-if="icon.kind === 'img'" :src="icon.value" :height="iconSize">
    <TokenImage v-else-if="icon.kind === 'token'" :token="icon.value" :height="iconSize" />
    <NeutralFigure v-else-if="icon.kind === 'figure'" :figure="icon.value" :width="iconSize" :height="iconSize" />
    <Meeple v-else-if="icon.kind === 'meeple'" :type="icon.value" class="color color-7" :style="{ width: iconSize + 'px', height: iconSize + 'px' }" />
    <svg v-else-if="icon.kind === 'acrobats'" class="meeple" :width="iconSize" :height="iconSize" viewBox="0 0 55 55">
      <g transform="scale(0.40)">
        <use :href="`${MEEPLES_SVG}#small-follower`" x="22" y="0" />
        <use :href="`${MEEPLES_SVG}#small-follower`" x="-1" y="41" />
        <use :href="`${MEEPLES_SVG}#small-follower`" x="46" y="41" />
      </g>
    </svg>
  </span>
</template>

<script>
// Renders the image / shape for a scoring category (city, road, monastery, ...). The
// mapping mirrors the per-feature header icons used by the final-score statistics
// (FinalStats.vue) — keep the two in sync. `name` may be a full score-expression name
// (e.g. "city.no-majority"); only the part before the first "." is used.
import Meeple from '@/components/game/Meeple'
import NeutralFigure from '@/components/game/NeutralFigure'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import TokenImage from '@/components/game/TokenImage'

const MEEPLES_SVG = require('~/assets/meeples.svg')

const MAPPING = {
  'tiles': { kind: 'tile-back', value: require('~/assets/icons/back.svg') },
  'road': { kind: 'tile', value: 'BA/RFr' },
  'city': { kind: 'tile', value: 'BA/Cccc+' },
  'monastery': { kind: 'img', value: require('~/assets/features/C1/cloister.png') },
  'garden': { kind: 'img', value: require('~/assets/features/C1/garden.png') },
  'field': { kind: 'tile', value: 'GQ/F' },
  'special-monastery': { kind: 'tile', value: 'MO/M1' },
  'castle': { kind: 'img', value: require('~/assets/figures/castle.png') },
  'watchtower': { kind: 'tile', value: 'WT/CFff_3C' },
  'trade-goods': { kind: 'img', value: require('~/assets/figures/trade.png') },
  'shrine': { kind: 'img', value: require('~/assets/features/C1/shrine.jpg') },
  'king': { kind: 'img', value: require('~/assets/figures/king.png') },
  'robber': { kind: 'img', value: require('~/assets/figures/robber.png') },
  'king+robber': { kind: 'img', value: require('~/assets/figures/king_robber.png') },
  'gold': { kind: 'img', value: require('~/assets/figures/gold.png') },
  'fairy': { kind: 'figure', value: 'fairy' },
  'black-fairy': { kind: 'figure', value: 'black-fairy' },
  'tower': { kind: 'tile', value: 'TO/F' },
  'flock': { kind: 'token', value: 'SHEEP_3X' },
  'ringmaster': { kind: 'meeple', value: 'Ringmaster' },
  'bigtop': { kind: 'figure', value: 'big-top' },
  'acrobats': { kind: 'acrobats' },
  'wind-rose': { kind: 'tile', value: 'WR/Rr' },
  'church': { kind: 'tile', value: 'DA/LRRRR' },
  'yaga-hut': { kind: 'tile', value: 'RU/L' },
  'vodyanoy': { kind: 'tile', value: 'RU/V' },
  'flowers': { kind: 'token', value: 'FLOWERS_YELLOW' },
  'obelisk': { kind: 'meeple', value: 'Obelisk' },
  'windmill': { kind: 'meeple', value: 'Windmill' },
  'decinsky-sneznik': { kind: 'meeple', value: 'Decinsky-Sneznik' },
  'river': { kind: 'img', value: require('~/assets/features/C1/fishermen.png') },
  'courier': { kind: 'figure', value: 'courier' },
  'fishhut': { kind: 'img', value: require('~/assets/features/C1/fishhut.png') },
  'marketplace': { kind: 'img', value: require('~/assets/features/C1/marketplace.png') }
}

export default {
  components: {
    Meeple,
    NeutralFigure,
    StandaloneTileImage,
    TokenImage
  },

  props: {
    name: { type: String, required: true },
    size: { type: Number, default: 32 }
  },

  data () {
    return {
      MEEPLES_SVG
    }
  },

  computed: {
    icon () {
      return MAPPING[this.name] || MAPPING[this.name.split('.')[0]] || null
    },

    // Normalize the visual size across icon kinds so they read consistently: full-tile
    // images (city/road/...) fill their box and look biggest, so render them smaller;
    // cropped png art (monastery/garden/...) has padding and looks smaller, so render it
    // larger. The result lands between the two extremes.
    iconSize () {
      const SCALE = {
        tile: 0.82,
        img: 1.15
      }
      const kind = this.icon ? this.icon.kind : null
      return Math.round(this.size * (SCALE[kind] || 1))
    }
  }
}
</script>

<style lang="sass" scoped>
.scoring-icon
  display: inline-flex
  align-items: center
  justify-content: center

  .tile-back
    object-fit: contain
    border-radius: 2px

// the tile back is black art — invert it in dark mode so it stays visible
#app.theme--dark .tile-back
  filter: invert(1)
</style>
