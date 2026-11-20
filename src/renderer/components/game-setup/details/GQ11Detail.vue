<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/26615/carcassonne-promo-tiles" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/Games_Quarterly_11_(1st_edition)" />
    </p>

    <AiExpansionInfo />

    <p>
      {{ $t('tile-set.gq11-release') }}
    </p>

    <TileDistribution :sets="{'gq11': 1, 'gq11/river': 1}" />
  </div>
</template>

<script>
import AiExpansionInfo from '@/components/game-setup/AiExpansionInfo'
import RulesLink from '@/components/RulesLink'
import TileDistribution from '@/components/TileDistribution'

export default {
  components: {
    AiExpansionInfo,
    RulesLink,
    TileDistribution
  }
}
</script>

<style lang="sass" scoped>
</style>
