<template>
  <div :class="`player-slot color-${number} ${slotState} ${readOnly || (slotState === 'open' && (limitReached || capReached)) ? '' : 'editable'}`" @click="toggle">
    <div
      v-if="order !== null && (readOnly || !randomized)"
      :class="`order order-${order}`"
    >
      {{ order }}
    </div>
    <svg class="meeple" :width="$vuetify.breakpoint.height > 768 ? 105 : 80" :height="$vuetify.breakpoint.height > 768 ? 105 : 80">
      <use :href="`${MEEPLES_SVG}#small-follower`" />
    </svg>
    <div class="state">
      <template v-if="slotState === 'open'">{{ $t('game-setup.create.open-slot') }}</template>
      <template v-if="slotState === 'local'">{{ $t('game-setup.create.local-player') }}</template>
      <template v-if="slotState === 'localai'">{{ $t('game-setup.create.local-ai-player') }}</template>
      <template v-if="slotState === 'remote'">{{ $t('game-setup.create.remote-player') }}</template>
      <template v-if="slotState === 'remoteai'">{{ $t('game-setup.create.remote-ai-player') }}</template>
      <template v-if="slotState === 'waiting'">{{ $t('game-setup.create.waiting-for-player') }}</template>
    </div>
    <div
      v-if="slotState === 'local'"
      class="name"
      @click.stop="openEdit"
    >
      {{ name }}
      <v-icon v-if="slotState === 'local' && !readOnly">fas fa-pencil-alt</v-icon>
    </div>
    <div v-else class="name">
      <!-- an empty seat I may take: the Assign / AI player buttons below say what to do -->
      <template v-if="slotState === 'open' && !readOnly && !limitReached && !capReached" />
      <!-- max-players cap reached → this empty seat is locked -->
      <span v-else-if="slotState === 'open' && !readOnly && capReached" class="limit-reached">
        {{ $t('game-setup.create.game-full') }}
      </span>
      <v-tooltip v-else-if="slotState === 'open' && !readOnly && limitReached" bottom>
        <template #activator="{ on }">
          <span class="limit-reached" v-on="on">
            {{ $t('game-setup.create.local-limit-reached') }}
            <v-icon small>fas fa-question-circle</v-icon>
          </span>
        </template>
        <span>{{ $tc('game-setup.create.local-limit-reached-tooltip-plural', localLimit, { limit: localLimit }) }}</span>
      </v-tooltip>
      <template v-else>{{ name }}</template>
    </div>

    <div
      v-if="isOwner && !readOnly && (slotState === 'remote' || slotState === 'remoteai' || slotState === 'waiting')"
      class="kick-wrapper"
      @click.stop
    >
      <v-btn
        class="kick-btn"
        x-small
        color="error"
        @click.stop="kickPlayer"
      >
        <v-icon x-small left>fas fa-times</v-icon>
        {{ $t('game-setup.create.kick-player') }}
      </v-btn>
    </div>

    <!-- An empty seat offers one choice, side by side at the bottom of the slot:
         - Assign: take it as a human player (same as clicking the slot);
         - AI player: take it for the AI. Greyed out, with the reason as a tooltip, when the setup
           has something the AI does not play (utils/ai-support.js).
         A taken seat cannot be switched between human and AI: my own (human or AI) shows Release
         instead, which leaves it (same as clicking it). -->
    <div
      v-if="showReleaseButton"
      class="kick-wrapper slot-actions"
      @click.stop
    >
      <v-btn
        class="kick-btn release-btn"
        x-small
        color="secondary"
        @click.stop="toggle"
      >
        <v-icon x-small left>fas fa-sign-out-alt</v-icon>
        {{ $t('game-setup.create.release-slot') }}
      </v-btn>
    </div>
    <div
      v-if="showAiButton"
      class="kick-wrapper slot-actions"
      @click.stop
    >
      <v-btn
        class="kick-btn assign-btn"
        x-small
        color="secondary"
        @click.stop="toggle"
      >
        <v-icon x-small left>fas fa-user</v-icon>
        {{ $t('game-setup.create.assign') }}
      </v-btn>
      <!-- the wrapper only carries the tooltip (a disabled button shows none); laid out as a plain
           flex box around the button, so both buttons sit and look exactly alike -->
      <span class="ai-btn-tooltip" :title="canMakeAi ? null : $t('game-setup.ai.not-available-hint')">
        <v-btn
          class="kick-btn ai-btn"
          x-small
          color="secondary"
          :disabled="!canMakeAi"
          @click.stop="makeAi"
        >
          <v-icon x-small left>fa-solid fa-robot</v-icon>
          {{ $t('game-setup.create.ai-player') }}
        </v-btn>
      </span>
    </div>

    <v-dialog v-model="edit" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="headline">{{ $t('game-setup.create.rename-player') }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-text-field ref="nameInput" v-model="editName" :label="$t('game-setup.create.name')" @keydown.enter="rename" />
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="edit = false">{{ $t('button.cancel') }}</v-btn>
          <v-btn text @click="rename">{{ $t('button.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'

import { aiSupport } from '@/utils/ai-support'

const MEEPLES_SVG = require('~/assets/meeples.svg')

export default {
  props: {
    number: { type: Number, required: true },
    owner: { type: String, default: null },
    client: { type: String, default: null },
    name: { type: String, default: null },
    ai: { type: Boolean, default: false },
    order: { type: Number, default: null },
    readOnly: { type: Boolean },
    limitReached: { type: Boolean, default: false },
    localLimit: { type: Number, default: null },
    // max-players cap reached → open seats are locked (can't take a new one)
    capReached: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false }
  },

  data () {
    return {
      MEEPLES_SVG,
      edit: false,
      editName: null
    }
  },

  computed: {
    ...mapState({
      sessionId: state => state.networking.sessionId,
      randomized: state => state.game.setup.options.randomizeSeating,
      gameKey: state => state.game.key
    }),

    // Release: on my own taken seat, human or AI
    showReleaseButton () {
      return !this.readOnly && (this.slotState === 'local' || this.slotState === 'localai')
    },

    // the Assign / AI player choice: only on an empty seat I may take
    showAiButton () {
      if (this.readOnly) return false
      return this.slotState === 'open' && !this.limitReached && !this.capReached
    },

    // ...and it works only when the AI plays everything in this game's setup
    aiSupported () {
      return aiSupport(this.$store.state.game.setup, this.$tiles).ok
    },

    canMakeAi () {
      return this.showAiButton && this.aiSupported
    },

    slotState () {
      if (this.owner === this.sessionId) {
        return 'local' + (this.ai ? 'ai' : '')
      }
      if (this.owner) {
        return 'remote' + (this.ai ? 'ai' : '')
      }
      if (this.gameKey) {
	    return this.client ? 'waiting' : 'open'
	  }
	  return 'open'
    }
  },

  methods: {
    // Clicking the slot: an empty one is taken (a human seat), one of mine — human or AI — is
    // left. Taking an empty seat for the AI is the separate "AI player" button (makeAi); a taken
    // seat is never switched between human and AI.
    toggle () {
      // read-only (e.g. a rematch, or viewing another's game) → slots are locked; a player
      // must not be able to release/take their own seat by clicking it
      if (this.readOnly) return
      const { number } = this
      if (this.slotState === 'local' || this.slotState === 'localai') {
        this.$store.dispatch('gameSetup/releaseSlot', { number })
      } else if (this.slotState === 'open') {
        if (this.limitReached || this.capReached) return
        this.$store.dispatch('gameSetup/takeSlot', { number })
      }
    },

    // The "AI player" button on an empty seat: take it, then hand it to the AI (the server only
    // lets a seat's owner change it to AI).
    async makeAi () {
      if (!this.canMakeAi || this.slotState !== 'open') return
      const { number } = this
      // shown as an AI seat from the first reply on (store game.js pendingAiSlots)
      this.$store.commit('game/pendingAiSlot', { number, pending: true })
      await this.$store.dispatch('gameSetup/takeSlot', { number })
      this.$store.dispatch('gameSetup/changeSlotToAi', { number })
    },

    kickPlayer () {
      if (!this.isOwner) return
      this.$store.dispatch('gameSetup/releaseSlot', { number: this.number })
    },

    openEdit () {
      if (!this.readOnly) {
        this.editName = this.name
        this.edit = true
        setTimeout(() => {
          this.$refs.nameInput.focus()
        }, 1)
      }
    },

    rename () {
      if (this.editName !== this.name) {
        this.$store.dispatch('gameSetup/renameSlot', { number: this.number, name: this.editName })
      }
      this.edit = false
    }
  }
}
</script>

<style lang="sass" scoped>
// The slot buttons (Assign / AI player / Release / Kick) are pinned 8px from the bottom edge, so
// the bottom padding keeps them clear of the name (8px + a 20px x-small button + a few px). The
// gaps above are tighter to pay for it: the slot is shorter overall than before the buttons.
.player-slot
  position: relative
  padding: 30px 0 34px 0

  display: flex
  flex-direction: column
  align-items: center

  +theme using ($theme)
    background: map-get($theme, 'slot-open-bg')
    color: map-get($theme, 'slot-open-text')

  .order
    position: absolute
    top: -70px
    right: -37px
    color: white
    font-size: 224px
    font-weight: 900
    opacity: 0.4
    z-index: 1

  .order-1
    right: -48px

  .order-4
    right: -34px

  svg
    margin-bottom: 16px

  .state
    font-size: 24px
    text-transform: uppercase
    font-weight: 300
    margin-bottom: 8px

  .name
    font-size: 24px
    height: 36px
    width: 100%
    text-align: center
    z-index: 2

    +theme using ($theme)
      color: map-get($theme, 'text-color')

    i
      visibility: hidden

    &:hover i
      visibility: visible

  &.open.editable
    .name
      font-size: 16px
      font-style: italic
      padding-top: 8px

      +theme using ($theme)
        color: map-get($theme, 'slot-assign-text')

  .kick-wrapper
    position: absolute
    bottom: 8px
    z-index: 2
    transition: transform 0.15s, filter 0.15s

    &:hover
      transform: scale(1.08)
      filter: brightness(1.15) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35))

  .kick-btn
    position: static

  .slot-actions
    display: flex
    align-items: center
    gap: 6px

    .ai-btn-tooltip
      display: inline-flex
      align-items: center

  // "Limit reached (?)" / "Game full" on a locked empty seat: centred on the name line like the
  // other empty-seat texts, its help icon always shown (the name line hides icons until hover —
  // that is for the rename pencil)
  .limit-reached
    display: inline-flex
    justify-content: center
    align-items: center
    gap: 4px
    padding-top: 8px
    font-size: 16px
    font-style: italic
    white-space: nowrap
    cursor: help

    i
      visibility: visible

  &.open, &.local, &.localai
    cursor: pointer

  &.local, &.localai, &.remote, &.remoteai, &.waiting
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.15), 0 3px 10px 0 rgba(0, 0, 0, 0.10)

  &.local, &.localai
    +theme using ($theme)
      background: map-get($theme, 'slot-local-bg')
      color: map-get($theme, 'slot-local-text')

  &.remote, &.remoteai, &.waiting
    +theme using ($theme)
      background: map-get($theme, 'slot-remote-bg')
      color: map-get($theme, 'slot-remote-text')

  &.open
    .order
      color: #ccc

@media (max-height: 768px)
  .player-slot
    padding: 12px 0 32px 0

    svg
      margin-bottom: 10px

    .state
      margin-bottom: 4px

    .state, .name
      font-size: 20px

    .order
      font-size: 136px
      top: -30px
      right: -22px

    .order-1
      right: -29px

    .order-4
      right: -21px
</style>