<template>
  <div>
    <ConfigSection :title="$t('game-setup.tiles.core-sets')">
      <div class="expansions">
        <ExpansionBox v-if="simplifiedOk(Expansion.BASIC)" :expansion="Expansion.BASIC" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.WINTER)" :expansion="Expansion.WINTER" @open-detail="openDetail" />
        <ExpansionBox v-if="simplifiedOk(Expansion.START)" :expansion="Expansion.START" @open-detail="openDetail" />
      </div>
    </ConfigSection>

    <ConfigSection :title="$t('game-setup.tiles.major-expansions')">
      <div class="expansions">
        <ExpansionBox v-if="simplifiedOk(Expansion.INNS_AND_CATHEDRALS)" :expansion="Expansion.INNS_AND_CATHEDRALS" @open-detail="openDetail" />
        <ExpansionBox v-if="simplifiedOk(Expansion.TRADERS_AND_BUILDERS)" :expansion="Expansion.TRADERS_AND_BUILDERS" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.PRINCESS_AND_DRAGON)" :expansion="Expansion.PRINCESS_AND_DRAGON" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.TOWER)" :expansion="Expansion.TOWER" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.ABBEY_AND_MAYOR)" :expansion="Expansion.ABBEY_AND_MAYOR" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.BRIDGES_CASTLES_AND_BAZAARS)" :expansion="Expansion.BRIDGES_CASTLES_AND_BAZAARS" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.HILLS_AND_SHEEP)" :expansion="Expansion.HILLS_AND_SHEEP" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.UNDER_THE_BIG_TOP_C1)" :expansion="Expansion.UNDER_THE_BIG_TOP_C1" @open-detail="openDetail" />
      </div>
    </ConfigSection>

    <ConfigSection v-if="!onlySimplified" :title="$t('game-setup.tiles.minor-expansions')">
      <div class="expansions">
        <ExpansionBox v-if="!ai" :expansion="Expansion.KING_AND_ROBBER" @open-detail="openDetail" />
        <ExpansionBox :expansion="Expansion.RIVER" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.SIEGE" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.COUNT" @open-detail="openDetail" />
        <ExpansionBox :expansion="Expansion.GQ11" @open-detail="openDetail" />
        <ExpansionBox :expansion="Expansion.CULT" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.TUNNEL" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.CORN_CIRCLES" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.FESTIVAL" @open-detail="openDetail" />
        <ExpansionBox :expansion="Expansion.WIND_ROSES" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.MONASTERIES" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.FLIER" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.FERRIES" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.GOLDMINES" @open-detail="openDetail" />
        <ExpansionBox v-if="!ai" :expansion="Expansion.MAGE_AND_WITCH" @open-detail="openDetail" />
        <ExpansionBox :expansion="Expansion.WATCHTOWERS" @open-detail="openDetail" />
      </div>
    </ConfigSection>

    <ConfigSection :title="$t('game-setup.tiles.promos')">
      <div class="expansions">
        <ExpansionBox v-if="!ai && simplifiedOk(Expansion.RUSSIAN_PROMOS)" :expansion="Expansion.RUSSIAN_PROMOS" @open-detail="openDetail" />
        <ExpansionBox v-if="simplifiedOk(Expansion.DARMSTADT)" :expansion="Expansion.DARMSTADT" @open-detail="openDetail" />
        <ExpansionBox v-if="simplifiedOk(Expansion.LABYRINTH)" :expansion="Expansion.LABYRINTH" @open-detail="openDetail" />
        <ExpansionBox v-if="simplifiedOk(Expansion.SPIEL_DOCH)" :expansion="Expansion.SPIEL_DOCH" @open-detail="openDetail" />
      </div>
    </ConfigSection>

    <ConfigSection
      v-if="fanExpansions.length > 0"
      :title="$t('game-setup.tiles.fan-expansions')"
    >
      <div class="expansions">
        <ExpansionBox
          v-for="exp in fanExpansions"
          :key="exp.name"
          :expansion="exp"
          @open-detail="openDetail"
        />
      </div>
    </ConfigSection>

    <v-dialog
      v-model="detailOpen"
      max-width="800"
    >
      <ExpansionDetailDialog :expansion="detailExpansion" @close="detailOpen = false" />
    </v-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ConfigSection from '@/components/game-setup/ConfigSection'
import { Expansion } from '@/models/expansions'
import ExpansionBox from '@/components/game-setup/ExpansionBox'
import ExpansionDetailDialog from '@/components/game-setup/ExpansionDetailDialog'

export default {
  components: {
    ConfigSection,
    ExpansionBox,
    ExpansionDetailDialog
  },

  data () {
    return {
      Expansion,
      detailOpen: false,
      detailExpansion: null
    }
  },

  computed: {
    ...mapState({
      ai: state => !!state.gameSetup.ai,
      sets: state => state.gameSetup.sets,
    }),

    // Only the bundled `jcz/simplified` artwork is available (the classic addon isn't installed —
    // e.g. the offline web build). Non-simplified sets would render as missing images, so the setup
    // offers only sets flagged `simplified`.
    onlySimplified () {
      return !this.$store.state.hasClassicAddon
    },

    fanExpansions () {
      return this.$tiles.expansions.filter(e => (!this.ai || e.ai) && this.simplifiedOk(e))
    }
  },

  methods: {
    // whether to show a set given the available artwork (see onlySimplified)
    simplifiedOk (exp) {
      return !this.onlySimplified || !!(exp && exp.simplified)
    },

    openDetail (exp) {
      this.detailExpansion = exp
      this.detailOpen = true
    }
  }
}
</script>

<style lang="sass" scoped>
.expansions
  flex: 1
  margin-top: $panel-gap
  display: grid
  width: 100%
  justify-content: center
  gap: $panel-gap
  grid-template-columns: repeat(auto-fill, 242px)
  grid-auto-flow: row

.exp-box.multiset
  grid-row-end: span 2
</style>
