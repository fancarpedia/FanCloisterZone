<template>
  <section>
    <template v-if="local">
      <ActionButton color="secondary" icon="fa-check" :label="$t('button.confirm')" @click="confirm" />
      <!-- Undo and "rotate the placed tile" both come from ActionPanel's slot, so this phase does
           NOT render its own undo - two of them read as "Confirm or Undo ... or or Undo". The tile
           is not committed until this confirmation, so turning it is still legal here
           (TILE_ROTATION_DISALLOWED is raised by the confirmation itself). -->
      <slot plain />
    </template>
    <span v-else class="text">
      {{ $t('game.action.waiting-for-player-confirmation') }}
    </span>
  </section>
</template>

<script>
import ActionButton from '@/components/game/actions/ActionButton'

export default {
  components: { ActionButton },

  props: {
    action: { type: Object, required: true },
    local: { type: Boolean }
  },

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
          type: 'TILE_CONFIRM',
          payload: {}
        })
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
