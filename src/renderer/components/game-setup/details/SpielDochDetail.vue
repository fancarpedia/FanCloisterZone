<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/260589/carcassonne-spiel-doch-mini-expansion" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/Spiel_Doch_Promo" />
    </p>

    <AiExpansionInfo />

    <TileDistribution :sets="{'spiel-doch': 1}" />
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
