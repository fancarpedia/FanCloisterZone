<template>
  <v-card class="test-result">
    <div class="btn-line">
      <v-btn @click="casesHidden = !casesHidden">{{ casesHidden ? $nuxt.$t('button.show') : $nuxt.$t('button.hide') }}</v-btn>
      <v-btn @click="$router.push('/')">{{ $nuxt.$t('button.close') }}</v-btn>
    </div>
    <div class="description">
      <b>{{ $nuxt.$t('dev.test') }}:</b><br>
      {{ result.description }}
    </div>
    <template v-if="!casesHidden">
      <div
        v-for="(ar, idx) in result.assertions"
        :key="idx"
        class="d-flex"
        :class="{ case: true, ok: ar.result, fail: !ar.result  }"
      >
        <span class="flex-grow-1 mr-5">{{ ar.assertion }}</span>
        <span class="pr-1">{{ ar.result ? $nuxt.$t('dev.ok') : ar.error || $nuxt.$t('dev.fail') }}</span>
      </div>
    </template>
  </v-card>
</template>

<script>
export default {
  props: {
    result: { type: Object, required: true }
  },

  data () {
    return {
      casesHidden: false
    }
  }
}
</script>

<style lang="sass" scoped>
.test-result
  padding: 30px 50px
  margin-left: 100px
  max-width: 40vw
  max-height: calc( 100% - 100px )
  overflow-y: scroll

  color: white
  background: rgba(0, 0, 0, 0.75)

  .btn-line
    display: flex
    justify-content: flex-end
    gap: 10px
    margin-bottom: 10px

  .description
    margin-bottom: 20px

  .case
    padding: 3px 6px

  .case.ok
    background: rgba(85, 139, 47, 0.5)
    color: white

  .case.fail
    background: rgba(198, 40, 40, 0.5)
    color: white
</style>
