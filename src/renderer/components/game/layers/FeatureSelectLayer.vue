<template>
  <g
    id="feature-select-layer"
    :class="`area-select-layer ${cssClass} ${(player === null ? '' : colorCssClass(player))}`"
  >
    <!-- `at`/`segment` are set only in wholeFeature mode, where one option is drawn as several
         areas - one per place of its feature. They share the option object, so hovering any part
         lights up all of them, and a click still sends the option itself. -->
    <g
      v-for="({option: opt, feature, abbotChoice, at, segment}) in optionsWithFeature"
      :key="segment || (positionAsKey(opt.position) + opt.feature + opt.location)"
      :transform="transformPosition(at || opt.position)"
    >
      <circle
        v-if="meeple == 'Barn' || meeple == 'Obelisk'"
        :x="0" :y="0" r="400"
        :class="{ area: true, mouseover: opt === mouseOver, mouseout: opt !== mouseOver }"
        @mouseenter="onMouseOver(opt)"
        @mouseleave="onMouseLeave(opt)"
        @click="ev => onSelect(ev, opt, abbotChoice)"
      />
      <g
        v-else
        :transform="transformRotation(feature.rotation) + ' ' + (feature.transform || '')"
        :class="{ area: true, mouseover: opt === mouseOver, mouseout: opt !== mouseOver }"
        @mouseenter="onMouseOver(opt)"
        @mouseleave="onMouseLeave(opt)"
        @click="ev => onSelect(ev, opt, abbotChoice)"
      >
        <FeatureClip :clip="feature.clip" />
      </g>
    </g>
  </g>
</template>

<script>
import { mapGetters } from 'vuex'

import LayerMixin from '@/components/game/layers/LayerMixin'
import FeatureClip from '@/components/game/layers/FeatureClip.vue'
import { wholeFeaturePlaces } from '@/utils/whole-feature'

export default {
  components: {
    FeatureClip
  },

  mixins: [LayerMixin],

  props: {
    options: { type: Array, required: true },
    player: { type: Number, default: null },
    meeple: { type: String, default: null },
    cssClass: { type: String, default: '' },
    // Draw each option over every place of its feature instead of only the place it points at.
    // Off by default: placing a meeple is about one tile's segment, scoring order is about the
    // whole feature.
    wholeFeature: { type: Boolean, default: false }
  },

  data () {
    return {
      mouseOver: null
    }
  },

  computed: {
    ...mapGetters({
      featureOn: 'game/featureOn'
    }),

    optionsWithFeature () {
      const optionsWithFeature = []
      const cloisterOptionsWithFeature = []
      const monasteries = []
      this.options.forEach(option => {
        if (option.location === 'AS_ABBOT') {
          monasteries.push(option)
          return
        }
        const tile = this.tileOn(option.position)
        let feature
        try {
          feature = this.$theme.getFeature(tile, option.feature, option.location, this.bridges)
        } catch (e) {
          // getFeature throws when the artwork has no such feature. The only expected case is a
          // meeple option on a BRIDGE road whose bridge is momentarily gone: during an undo the
          // `options` prop (pushed to board.layers on Vue.nextTick, see LayeredItemMixin) lags the
          // `bridges` list (derived synchronously from history) by one render, so the option outlives
          // its bridge. Skip it for this render; it reappears once the props catch up. NOTE: normal
          // straight roads are Road/NS or Road/WE too (e.g. the start tile BA/RCr's W–E road) and own
          // a native feature, so getFeature resolves them and they are never skipped.
          console.warn('Skipping meeple option without artwork feature:', tile?.id, option.feature + '/' + option.location)
          return
        }
        const opt = { option, feature, abbotChoice: null }

        if (!opt.feature.clip) {
          console.error(`Clipping is not defined for ${tile.id} ${option.location}`)
        }

        if (this.wholeFeature) {
          wholeFeaturePlaces(option, this.featureOn).forEach(({ position, location }) => {
            let part
            try {
              part = this.$theme.getFeature(this.tileOn(position), option.feature, location, this.bridges)
            } catch (e) {
              return // a place without artwork for this feature - skip that part, keep the rest
            }
            if (part && part.clip) {
              optionsWithFeature.push({
                option,
                feature: part,
                abbotChoice: null,
                at: position,
                segment: this.positionAsKey(position) + option.feature + location
              })
            }
          })
          return
        }

        optionsWithFeature.push(opt)
        if (option.location === 'I') {
          cloisterOptionsWithFeature.push(opt)
        }
      })

      monasteries.forEach(m => {
        const opt = cloisterOptionsWithFeature.find(({ option }) => option.position[0] === m.position[0] && option.position[1] === m.position[1])
        if (opt) {
          opt.abbotChoice = 'monk-or-as-abbot'
        } else {
          // abbot only placement
          const tile = this.tileOn(m.position)
          optionsWithFeature.push({
            option: m,
            feature: this.$theme.getFeature(tile, 'Monastery', 'I', this.bridges),
            abbotChoice: 'as-abbot-only'
          })
        }
      })

      optionsWithFeature.sort((a, b) => {
        const aBridge = a.feature.bridge || 0
        const bBridge = b.feature.bridge || 0
        if (aBridge !== bBridge) {
          return aBridge - bBridge
        }

        const aField = a.option.feature === 'Field'
        const bField = b.option.feature === 'Field'
        if (aField !== bField) {
          return bField - aField
        }
        return 0
      })

      return optionsWithFeature
    }
  },

  methods: {
    onMouseOver (opt) {
      this.mouseOver = opt
    },

    onMouseLeave (opt) {
      this.mouseOver = null
    },

    onSelect (ev, option, abbotChoice) {
      if (!this.isDragging(ev)) {
        if (abbotChoice) {
          this.$store.commit('gameDialog', {
            type: 'monk-or-abbot',
            attrs: {
              player: this.player,
              meeple: this.meeple,
              choice: abbotChoice,
              option
            }
          })
        } else {
          this.$root.$emit('feature.select', option)
        }
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.area.mouseout
  opacity: 0.25
</style>
