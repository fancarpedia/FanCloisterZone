<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/66646/carcassonne-expansion-8-bridges-castles-and-bazaar" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/Bridges,_Castles_and_Bazaars" />
      <RulesLink :title="$t('button.rules-1st-edition')" href="https://wikicarpedia.com/car/Special:MyLanguage/Bridges,_Castles_and_Bazaars_(1st_edition)" />
    </p>

    <AiExpansionInfo />

    <p>
      {{ $t('tile-set.bridges-castles-and-bazaars-release') }}
    </p>

    <TileDistribution :sets="{'bridges-castles-and-bazaars': 1}" />
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
