<template>
  <section @click="onClick">
    <div class="expr-title">
      <div>{{ title }}</div>
      <div v-if="subtitle" class="sub">{{ subtitle }}</div>
    </div>
    <div class="expr-row">
      <!-- the cause first … -->
      <template v-if="causeVisual">
        <div class="cause" :class="causeVisual.player === undefined ? '' : colorCssClass(causeVisual.player)">
          <StandaloneTileImage
            v-if="causeVisual.tile"
            :tile-id="causeVisual.tile.id"
            :rotation="causeVisual.tile.rotation"
            :size="tileSize"
          />
          <img v-else-if="causeVisual.image" :src="causeVisual.image" class="source-image">
          <Meeple v-else-if="causeVisual.meeple" :type="causeVisual.meeple" />
          <NeutralFigure v-else-if="causeVisual.figure" :figure="causeVisual.figure" />
        </div>
        <v-icon class="because">fas fa-arrow-right</v-icon>
      </template>
      <!-- … then what it placed / moved / removed -->
      <!-- a figure that walked to a deployed meeple stands next to it, as on the board -->
      <div v-if="besideMeeple" class="subject beside-meeple">
        <Meeple :type="besideMeeple.type" :class="colorCssClass(besideMeeple.player)" />
        <NeutralFigure class="beside" :figure="figureSymbol(expr.figure)" />
      </div>
      <div v-else class="subject" :class="expr.player === null || expr.player === undefined ? '' : colorCssClass(expr.player)">
        <NeutralFigure v-if="expr.figure" :figure="figureSymbol(expr.figure)" />
        <Meeple v-else-if="expr.meeple" :type="expr.meeple" />
        <StandaloneTileImage
          v-else-if="expr.tile"
          :tile-id="expr.tile.id"
          :rotation="expr.tile.rotation"
          :size="tileSize"
        />
        <TokenImage v-else-if="expr.token" :token="expr.token" :height="40" />
      </div>
    </div>
  </section>
</template>

<script>
// Action-panel content while hovering a history event that placed, moved or removed a figure or
// piece. Either the player did it of their own will (a regular deployment: "Deployed by …"), or the
// game did it as a consequence of something else (an engine PlacementCause: "Caused by: …", with
// the cause — placed tile, deployed meeple, moving figure — drawn before the figure).
// Like DiceRollPanel / ReturnedMeeplePanel: set through board/placementPanel, cleared on click/leave.
import { mapGetters } from 'vuex'

import Meeple from '@/components/game/Meeple'
import NeutralFigure from '@/components/game/NeutralFigure'
import StandaloneTileImage from '@/components/game/StandaloneTileImage'
import TokenImage from '@/components/game/TokenImage'
import { causeTitle } from '@/utils/placement-cause'

// figure ids are "<kind>.<n>"; the sprite / locale names differ for the big top
const figureKind = id => (id || '').split('.')[0]
const SYMBOL = { bigtop: 'big-top' }
const ELEMENT_KEY = { bigtop: 'big-top' }

// a meeple's return source (engine ReturnMeepleSource) → its name, and its artwork where the return
// choice (ReturnMeepleItem) draws one
const SOURCE_KEYS = {
  PRINCESS: 'game.feature.princess',
  ROBBERS_SON: 'game.feature.robbers-son',
  FESTIVAL: 'game.feature.festival',
  SIEGE_ESCAPE: 'game.feature.escape',
  CORN_CIRCLE: 'game.feature.crop-circle',
  ABBOT_RETURN: 'game.element.abbot',
  MONASTERY_SHRINE_CHALLENGE: 'game.feature.shrine-challenge',
  BARN_PLACEMENT: 'game.element.barn',
  BARN_FIELD_JOIN: 'game.element.barn',
  TRAP: 'game.cause.rule.trap'
}
const SOURCE_IMAGES = {
  PRINCESS: require('~/assets/features/C1/princess.png'),
  ROBBERS_SON: require('~/assets/features/C1/robbers-son.png'),
  FESTIVAL: require('~/assets/features/C1/festival.png')
}

export default {
  components: {
    Meeple,
    NeutralFigure,
    StandaloneTileImage,
    TokenImage
  },

  props: {
    // { kind: 'placed'|'moved'|'removed', figure?|meeple?|tile?|token?, player?, to?, cause,
    //   byPlayer?, titleKey?, byKey? } — titleKey / byKey override the generic title and the
    //   "… by <player>" line (a placed tile, a castle)
    expr: { type: Object, required: true }
  },

  computed: {
    ...mapGetters({
      colorCssClass: 'game/colorCssClass',
      tileOn: 'game/tileOn'
    }),

    tileSize () {
      return this.$vuetify.breakpoint.height > 768 ? 60 : 44
    },

    subjectName () {
      const { figure, meeple, token } = this.expr
      if (figure) {
        const kind = figureKind(figure)
        const key = 'game.element.' + (ELEMENT_KEY[kind] || kind)
        return this.$te(key) ? this.$t(key) : kind
      }
      // meeple class names (SmallFollower) and token names (GOLD, SHEEP_2X) → element keys
      // (small-follower, gold, sheep); the raw name only if there is none
      const name = meeple || token || ''
      const kebab = meeple
        ? name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
        : name.split('_')[0].toLowerCase()
      const key = 'game.element.' + kebab
      if (this.$te(key)) return this.$t(key)
      if (token && this.$te('game.feature.' + kebab)) return this.$t('game.feature.' + kebab)
      return name
    },

    title () {
      if (this.expr.titleKey) return this.$t(this.expr.titleKey)
      const { kind, to } = this.expr
      // the courier is placed on the letter symbol of the tile that summoned it
      if (to && to.feature === 'CourierLetter') {
        return this.$t('game.placement.title.placed-on-letter', { figure: this.subjectName })
      }
      return this.$t('game.placement.title.' + (kind || 'moved'), { figure: this.subjectName })
    },

    subtitle () {
      if (this.expr.cause) return causeTitle(this.expr.cause, this)
      // removed through a player's special figure / tile (Princess, Robber's Son, Festival, …):
      // what removed it, and who used it
      if (this.expr.source) {
        const what = this.sourceName
        return this.playerName
          ? this.$t('game.placement.removed-with', { source: what, player: this.playerName })
          : what
      }
      // the player's own choice, not a cause: who deployed / moved it
      if (this.expr.byPlayer && this.playerName) {
        const key = this.expr.byKey ||
          (this.expr.kind === 'moved' ? 'game.placement.moved-by' : 'game.placement.deployed-by')
        return this.$t(key, { player: this.playerName })
      }
      return ''
    },

    // who did it: `actor` when it differs from the figure's owner (the Princess removes an opponent's
    // knight), else the owner
    playerName () {
      const players = (this.$store.state.game && this.$store.state.game.players) || []
      const idx = this.expr.actor !== undefined && this.expr.actor !== null ? this.expr.actor : this.expr.player
      const p = players[idx]
      return p ? p.name : ''
    },

    // a ReturnMeepleSource (PRINCESS, ROBBERS_SON, …) by its game name
    sourceName () {
      const key = SOURCE_KEYS[this.expr.source]
      return key && this.$te(key) ? this.$t(key) : this.expr.source
    },

    // a neutral figure moved to the meeple whose deployment caused it (the courier): that meeple,
    // to draw the figure standing beside it
    besideMeeple () {
      const c = this.expr.cause
      if (!this.expr.figure || !c || c.type !== 'meeple-deployed' || !c.meeple) return null
      return { type: c.meeple.type, player: c.meeple.player }
    },

    // the cause drawn next to the figure, when it is something on the board
    causeVisual () {
      // a return source drawn as its tile artwork (Princess, Robber's Son, Festival)
      if (!this.expr.cause && this.expr.source && SOURCE_IMAGES[this.expr.source]) {
        return { image: SOURCE_IMAGES[this.expr.source] }
      }
      const c = this.expr.cause
      if (!c) return null
      if (c.type === 'tile-placed') {
        const tile = this.tileOn(c.position)
        return tile ? { tile } : null
      }
      if (c.type === 'meeple-deployed' && c.meeple) {
        return { meeple: c.meeple.type, player: c.meeple.player }
      }
      if (c.type === 'figure-moved') {
        return { figure: SYMBOL[figureKind(c.figure)] || figureKind(c.figure) }
      }
      return null
    }
  },

  methods: {
    figureSymbol (id) {
      const kind = figureKind(id)
      return SYMBOL[kind] || kind
    },

    onClick () {
      this.$store.commit('board/placementPanel', null)
    }
  }
}
</script>

<style lang="sass" scoped>
.expr-row
  display: flex
  align-items: center
  justify-content: center
  gap: 12px
  height: 100%

  .because
    +theme using ($theme)
      color: map-get($theme, 'gray-text-color')

.expr-title
  position: absolute
  left: 0
  max-width: 50%
  height: var(--action-bar-height)
  line-height: 1
  display: flex
  flex-direction: column
  justify-content: center
  padding-left: 20px
  font-size: 20px
  font-weight: 300

  .sub
    font-size: 16px
    margin-top: 4px

svg.meeple, svg.neutral
  max-width: 40px
  height: 40px

// tokens drawn in the theme's text colour, the same rule as the history bullets (PlayEvent) — the
// castle symbol would otherwise stay black on the dark theme
.token-image:not(.tunnel):not(.token-BRIDGE)
  +theme using ($theme)
    fill: map-get($theme, 'text-color')

.source-image
  height: 54px

// the figure next to the meeple, slightly smaller and overlapping its side, as on the board
.beside-meeple
  display: flex
  align-items: flex-end

  svg.neutral.beside
    width: 40px
    height: 40px
    margin-left: -10px
</style>
