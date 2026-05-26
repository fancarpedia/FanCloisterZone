<template>
  <div
    :class="{
      'exp-box': true,
      [expansion.name]: true,
      'selected': selected,
      'multiset': expansion.releases.length > 1,
      ['multiset-' + expansion.releases.length]: expansion.releases.length > 1
    }"
  >
    <a href="#" class="detail-link" @click.prevent="open">
      <v-icon>fas fa-layer-group</v-icon>
    </a>

    <template v-if="expansion.releases.length === 1">
      <div @click.capture="onSingleSetClick">
        <ReleaseButtons :release="expansion.releases[0]">
          <div class="exp-title">
            <ExpansionSymbol :expansion="expansion" />
            <h3>{{ title(expansion.title, expansion.name.toLowerCase().replaceAll('_','-')) }}</h3>
          </div>
        </ReleaseButtons>
      </div>
    </template>
    <template v-else>
      <div class="exp-title" @click="onMultisetTitleClick">
        <ExpansionSymbol :expansion="expansion" />
        <h3>{{ title(expansion.title, expansion.name.toLowerCase().replaceAll('_','-')) }}</h3>
      </div>
      <div
        v-for="(release, idx) in expansion.releases"
        :key="idx"
        class="tile-set-row"
      >
        <ReleaseButtons :release="release">
          <h4 :title="release.note">{{ title(release.title, release.id) }}</h4>
        </ReleaseButtons>
      </div>
    </template>

    <div v-if="showWarning && hasMissingRequirements" class="requirement-warning">
      <v-icon small>fas fa-exclamation-triangle</v-icon>
      <span v-if="missingRequirements.named.length">
        {{ $t('game-setup.requires-expansion', { expansions: missingRequirements.named.map(expansionTitle).join(', ') }) }}
      </span>
      <span v-for="group in missingRequirements.groups" :key="group">
        {{ $t('game-setup.requires-one-from-group', { groups: groupMemberTitles(group).join(', ') }) }}
      </span>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ExpansionSymbol from '@/components/ExpansionSymbol'
import ReleaseButtons from '@/components/game-setup/buttons/ReleaseButtons'

export default {
  components: {
    ExpansionSymbol,
    ReleaseButtons
  },

  props: {
    expansion: { type: Object, required: true }
  },

  data () {
    return {
      showWarning: false
    }
  },

  watch: {
    selected (val, oldVal) {
      if (val) {
        this.showWarning = false
      } else if (oldVal && this.hasMissingRequirements) {
        this.showWarning = true
      }
    }
  },

  computed: {
    ...mapState({
      sets: state => state.gameSetup.sets || {}
    }),

    selected () {
      for (const release of this.expansion.releases) {
        for (const id of release.sets) {
          if (this.sets[id]) return true
        }
      }
      return false
    },

    missingRequirements () {
      const edition = this.$store.state.gameSetup.rules?.edition || '2'
      const currentExpansions = this.$tiles.getExpansions(this.sets, edition)
      const missingNamed = new Set()
      const missingGroups = new Set()

      for (const release of this.expansion.releases) {
        for (const id of release.sets) {
          const set = this.$tiles.sets[id] || this.$tiles.sets[id + ':1'] || this.$tiles.sets[id + ':2']
          const deps = set?.dependencies

          for (const dep of deps?.expansion || []) {
            if (!(dep in currentExpansions)) missingNamed.add(dep)
          }

          for (const group of deps?.groups || []) {
            const members = this.$tiles.expansionGroups?.[group] || []
            if (!members.some(m => m in currentExpansions)) missingGroups.add(group)
          }
        }
      }

      return {
        named: Array.from(missingNamed),
        groups: Array.from(missingGroups)
      }
    },

    hasMissingRequirements () {
      return this.missingRequirements.named.length > 0 || this.missingRequirements.groups.length > 0
    }
  },

  methods: {
    open () {
      this.$emit('open-detail', this.expansion)
    },

    onSingleSetClick () {
      if (this.selected) { this.showWarning = false; return }
      this.$nextTick(() => { if (!this.selected) this.showWarning = true })
    },

    onMultisetTitleClick () {
      if (this.selected) {
        this.showWarning = false
        for (const release of this.expansion.releases) {
          this.$store.dispatch('gameSetup/setReleaseQuantity', { release, quantity: 0 })
        }
      } else {
        this.$store.dispatch('gameSetup/setReleaseQuantity', { release: this.expansion.releases[0], quantity: 1 })
        this.$nextTick(() => { if (!this.selected) this.showWarning = true })
      }
    },

    expansionTitle (name) {
      const langId = 'expansion.' + name.toLowerCase().replaceAll('_', '-')
      return this.$te(langId) ? this.$t(langId) : (this.$tiles.expansions.find(e => e.name === name)?.title || name)
    },

    groupMemberTitles (group) {
      const members = this.$tiles.expansionGroups?.[group] || []
      return members.map(this.expansionTitle)
    },

    title (originalTitle, id) {
      const langId = ['expansion', id].join('.')
      return this.$te(langId) ? this.$t(langId) : originalTitle
    }
  }
}
</script>

<style lang="sass" scoped>
.exp-box
  display: flex
  flex-direction: column
  position: relative

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: map-get($theme, 'cards-bg')

  .exp-title
    text-align: center
    padding: 24px 0 8px 0

    svg
      +theme using ($theme)
        fill: map-get($theme, 'cards-text')

    h3
      font-size: 1.09em
      font-weight: 300
      margin-top: 16px

    .exp-symbol
      display: block
      margin: 0 auto
      width: 55px
      height: 55px

  .detail-link
    position: absolute
    display: block
    text-decoration: none
    top: 0
    right: 0

    .v-icon
      font-size: 28px
      margin: 8px
      transition: none !important

      +theme using ($theme)
        color: map-get($theme, 'link-detail-color')

    &:hover .v-icon
      +theme using ($theme)
        color: map-get($theme, 'text-color')

  &.selected
    +theme using ($theme)
      background: map-get($theme, 'cards-selected-bg')
      box-shadow: map-get($theme, 'cards-selected-shadow')

    h3
      +theme using ($theme)
        color: map-get($theme, 'cards-selected-text')

    .exp-title
      svg
        +theme using ($theme)
          fill: map-get($theme, 'cards-selected-text')

    .detail-link
      .v-icon
        +theme using ($theme)
          color: map-get($theme, 'link-detail-selected-color')

      &:hover .v-icon
        +theme using ($theme)
          color: map-get($theme, 'cards-selected-text')

.multiset
  .exp-title
    cursor: pointer
    padding-bottom: 20px

  h4
    margin-bottom: 6px

.tile-set-row
  text-align: center
  flex: 1
  display: flex
  align-items: flex-end
  justify-content: stretch

  +theme using ($theme)
    border-top: 1px solid #{map-get($theme, 'line-color-light')}

  .quantity-buttons
    width: 100%

  h4
    text-align: center
    font-weight: 400

.requirement-warning
  position: absolute
  bottom: 0
  left: 0
  right: 0
  font-size: 0.8em
  font-weight: 400
  text-align: center
  padding: 6px 10px 8px
  display: flex
  align-items: center
  justify-content: center
  gap: 5px
  z-index: 1

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background-color: rgba(map-get($theme, 'cards-bg'), 0.92)
    border-top: 1px solid #{map-get($theme, 'line-color-light')}

  .v-icon
    font-size: 0.9em

</style>