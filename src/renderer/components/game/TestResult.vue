<template>
  <v-card class="test-result">
    <div class="btn-line">
      <v-btn @click="$router.push('/test-runner')">{{ $nuxt.$t('button.test-runner') }}</v-btn>
      <v-btn @click="$router.push('/')">{{ $nuxt.$t('button.close') }}</v-btn>
      <v-btn @click="$store.commit('game/testScenarioResult', null)">{{ $nuxt.$t('button.hide') }}</v-btn>
    </div>
    <div class="description">
      <b>{{ $nuxt.$t('dev.test') }}:</b><br>
      {{ result.description }}
    </div>
    <div
      v-for="(ar, idx) in result.assertions"
      :key="idx"
      class="d-flex"
      :class="{ case: true, ok: ar.result, fail: !ar.result  }"
    >
      <span class="flex-grow-1 mr-5">{{ ar.assertion }}</span>
      <span class="pr-1">{{ ar.result ? $nuxt.$t('dev.ok') : ar.error || $nuxt.$t('dev.fail') }}</span>
    </div>
  </v-card>
</template>

<script>
export default {
  props: {
    result: { type: Object, required: true }
  }
}
</script>

<style lang="sass" scoped>
.test-result
  padding: 30px 50px
  margin-left: 100px
  max-height: calc( 100% - 100px )
  overflow-y: scroll

  +theme using ($theme)
    color: map-get($theme, 'cards-text')
    background: map-get($theme, 'cards-bg')

  .btn-line
    margin-bottom: 10px

  .description
    margin-bottom: 20px

  .case
    padding: 3px 6px

  .case.ok
    background: #558B2F
    color: white

  .case.fail
    background: #C62828
    color: white
</style>
