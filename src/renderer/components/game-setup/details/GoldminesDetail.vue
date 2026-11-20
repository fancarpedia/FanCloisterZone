<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgameexpansion/118617/carcassonne-gold-mines" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/The_Goldmines" />
      <RulesLink :title="$t('button.rules-1st-edition')" href="https://wikicarpedia.com/car/Special:MyLanguage/The_Goldmines_(1st_edition)" />
    </p>

    <AiExpansionInfo />

    <TileDistribution :sets="{'goldmines': 1}" />
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
