<template>
  <div class="header-message">
    <div v-if="engine && engine.error" class="warning-text">
      {{ $t('core-messages.game-engine-not-available') }}
    </div>
    <div v-else-if="!containsCoreSet" class="info-text">
      {{ $t('core-messages.no-core-set') }}
    </div>
    <div v-else-if="info" class="info-text">
      {{ info }}
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    info: { type: String, default: null },
    sets: { type: Object, required: true }
  },

  computed: {
    ...mapState({
      engine: state => state.engine
    }),

    containsCoreSet () {
      return this.sets.basic || this.sets['basic:1'] || this.sets['basic:2'] ||
        this.sets.winter || this.sets['winter:1'] || this.sets['winter:2'] ||
        this.sets.start
    }
  }
}
</script>

<style lang="sass" scoped>
.header-message
  display: flex
  align-items: center

.warning-text, .info-text
  font-size: 24px
  white-space: nowrap
  color: white
  margin-right: 20px
  padding: 0 10px
  border-radius: 4px

.warning-text
  background-color: #F44336

.info-text
  background-color: #3F51B5
</style>
