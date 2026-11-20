<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/59065/carcassonne-der-tunnel" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/The_Tunnel_(1st_edition)" />
    </p>

    <AiExpansionInfo />

    <TileDistribution :sets="{'tunnel': 1}" />
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
