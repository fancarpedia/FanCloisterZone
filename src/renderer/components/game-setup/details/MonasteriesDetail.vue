<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/158041/carcassonne-kloster-deutschland" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/Monasteries" />
      <RulesLink :title="$t('button.rules-1st-edition')" href="https://wikicarpedia.com/car/Special:MyLanguage/Monasteries_(1st_edition)" />
    </p>

    <AiExpansionInfo />

    <TileDistribution :sets="{'monasteries': 1}" />
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
