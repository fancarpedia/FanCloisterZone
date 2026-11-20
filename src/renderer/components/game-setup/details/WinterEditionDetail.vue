<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/131014/carcassonne-winter-edition" />
    </p>

    <AiExpansionInfo />

    <p>
      {{ $t('tile-set.winter-edition-description') }}
    </p>

    <TileDistribution :sets="{winter: 1}" />
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
