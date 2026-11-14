<template>
  <section>
    <template v-if="local">
      <ActionButton color="secondary" icon="fa-check" :label="$t('button.confirm')" @click="confirm" />
      <template v-if="undoAllowed">
        <ActionButton icon="fa-undo" :label="$t('button.undo')" @click="undo" />
      </template>
      <span class="text">
        {{ $t('game.action.shepherd-placement') }}
      </span>
    </template>
    <span v-else class="text">
      {{ $t('game.action.waiting-for-player-confirmation') }}
    </span>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'

import ActionButton from '@/components/game/actions/ActionButton'

export default {
  components: { ActionButton },

  props: {
    action: { type: Object, required: true },
    local: { type: Boolean }
  },

  computed: mapGetters({
    undoAllowed: 'game/isUndoAllowed'
  }),

  mounted () {
    window.addEventListener('keydown', this.onKeyDown)
  },

  beforeDestroy () {
    window.removeEventListener('keydown', this.onKeyDown)
  },

  methods: {
    async confirm () {
      if (this.local) {
        await this.$store.dispatch('game/apply', {
          type: 'SHEPHERD_CONFIRM',
          payload: {}
        })
      }
    },

    async undo () {
      if (this.local) {
        await this.$store.dispatch('game/undo')
      }
    },

    onKeyDown (ev) {
      if (ev.key === ' ') {
        this.confirm()
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.v-btn
  margin: 0 20px
</style>
