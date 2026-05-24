<template>
  <div>
    <p>
      <RulesLink href="https://boardgamegeek.com/boardgame/5405/carcassonne-expansion-2-traders-builders" />
      <RulesLink :title="$t('button.rules')" href="https://wikicarpedia.com/car/Special:MyLanguage/Traders_and_Builders" />
    </p>

    <p>
      {{ $t('tile-set.under-the-big-top-c1-release') }}
    </p>

    <TileDistribution :sets="{'under-the-big-top-c1': 1}" />
  </div>
</template>

<script>
import RulesLink from '@/components/RulesLink'
import TileDistribution from '@/components/TileDistribution'

export default {
  components: {
    RulesLink,
    TileDistribution
  }
}
</script>

<style lang="sass" scoped>
</style>
