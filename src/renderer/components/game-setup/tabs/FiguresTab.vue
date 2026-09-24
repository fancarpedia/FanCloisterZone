<template>
  <div>
    <ConfigSection :title="$t('game-setup.components.followers')">
      <div class="components">
        <GameElementBox :item="GameElement.SMALL_FOLLOWER" :max="99" :reset="7" />
        <GameElementBox v-if="!ai" :item="GameElement.ABBOT" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.PHANTOM" :max="9" />
        <GameElementBox :item="GameElement.BIG_FOLLOWER" :max="9" />
        <GameElementBox :item="GameElement.BUILDER" :max="9" />
        <GameElementBox :item="GameElement.PIG" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.MAYOR" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.WAGON" :max="9" />
        <!-- the barn is forced off in the Keep Building coop variant (field feature) -->
        <GameElementBox v-if="!ai && !coopVariant" :item="GameElement.BARN" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.SHEPHERD" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.RINGMASTER" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.OBELISK" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.WINDMILL" :max="9" />
        <GameElementBox v-if="!ai" :item="GameElement.DECINSKY_SNEZNIK" :max="9" />
      </div>
    </ConfigSection>

    <ConfigSection v-if="!ai" :title="$t('game-setup.components.neutral-figures')">
      <div class="components">
        <GameElementBox :item="GameElement.FAIRY" />
        <GameElementBox :item="GameElement.BLACK_FAIRY" />
        <GameElementBox :item="GameElement.DRAGON" />
        <GameElementBox :item="GameElement.COUNT" />
        <GameElementBox :item="GameElement.MAGE" />
        <GameElementBox :item="GameElement.WITCH" />
        <GameElementBox :item="GameElement.BIG_TOP" />
        <GameElementBox :item="GameElement.DONKEY" />
        <GameElementBox :item="GameElement.COURIER" />
      </div>
    </ConfigSection>

    <ConfigSection v-if="!ai" :title="$t('game-setup.components.tokens')">
      <div class="components">
        <GameElementBox :item="GameElement.TOWER" />
        <GameElementBox :item="GameElement.BLACK_TOWER" />
        <GameElementBox :item="GameElement.ABBEY" :max="9" />
        <GameElementBox :item="GameElement.BRIDGE" />
        <GameElementBox :item="GameElement.CASTLE" />
        <GameElementBox :item="GameElement.TUNNEL" :mutable="false" />
        <GameElementBox :item="GameElement.FERRY" :mutable="false" />
        <GameElementBox :item="GameElement.LITTLE_BUILDINGS" />
      </div>
    </ConfigSection>

    <ConfigSection :title="$t('game-setup.components.rewards')">
      <div class="components">
        <GameElementBox :item="GameElement.TRADERS" />
        <GameElementBox v-if="!ai" :item="GameElement.KING" />
        <GameElementBox v-if="!ai" :item="GameElement.ROBBER" />
        <GameElementBox v-if="!ai" :item="GameElement.GOLD" />
      </div>
    </ConfigSection>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import ConfigSection from '@/components/game-setup/ConfigSection'
import { GameElement } from '@/models/elements'
import GameElementBox from '@/components/game-setup/GameElementBox'

export default {
  components: {
    ConfigSection,
    GameElementBox
  },

  data () {
    return {
      GameElement
    }
  },

  computed: {
    ...mapState({
      ai: state => !!state.gameSetup.ai,
      detail: state => state.gameSetup.detail,
      figures: state => state.gameSetup.figures,
      coopVariant: state => !!state.gameSetup.elements['keep-building']
    })
  }
}
</script>

<style lang="sass" scoped>
.components
  flex: 1
  margin-top: $panel-gap
  display: grid
  width: 100%
  justify-content: center
  gap: $panel-gap
  grid-template-columns: repeat(auto-fill, 162px)
  grid-auto-flow: row
</style>
