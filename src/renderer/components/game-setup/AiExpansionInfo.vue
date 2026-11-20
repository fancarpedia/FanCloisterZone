<template>
  <!-- can AI players play this tile set (utils/ai-support.js aiExpansionLevel) — the same robot and
       mark as the expansion box's badge, with the sentence. Placed under the links of each tile-set
       detail; the expansion comes from ExpansionDetailDialog (provide / inject). -->
  <div v-if="expansion" class="ai-info" :class="'ai-' + aiLevel.level">
    <span class="ai-robot">
      <v-icon small>fa-solid fa-robot</v-icon>
      <span v-if="aiLevel.level === 'ai'" class="ai-mark ai-ok">&#10003;</span>
      <span v-else-if="aiLevel.level === 'allowed'" class="ai-mark ai-info-mark">i</span>
      <span v-else-if="aiLevel.level === 'implied'" class="ai-mark ai-excl">!</span>
    </span>
    <span class="ai-text">{{ aiText }}</span>
  </div>
</template>

<script>
import { aiExpansionLevel, aiLevelText } from '@/utils/ai-support'

export default {
  inject: {
    aiExpansion: { default: null }
  },

  computed: {
    expansion () {
      return this.aiExpansion ? this.aiExpansion() : null
    },

    aiLevel () {
      return aiExpansionLevel(this.expansion)
    },

    aiText () {
      return aiLevelText(this.aiLevel, this)
    }
  }
}
</script>

<style lang="sass" scoped>
.ai-info
  display: flex
  align-items: center
  gap: 14px
  margin: 4px 0 16px
  padding-top: 8px

  &.ai-none .ai-robot
    opacity: 0.6

  &.ai-implied .v-icon
    opacity: 0.45

.ai-robot
  position: relative
  display: inline-flex

  // 50% larger than a small icon, as on the expansion box
  .v-icon
    font-size: 24px !important

// green check: the AI plays it; blue "i": by default, an allowed element would rule AI out;
// amber "!" (dimmed robot): only once an element it switches on is turned off
.ai-mark
  position: absolute
  top: -8px
  right: -13px
  width: 21px
  height: 21px
  border-radius: 50%
  color: white
  font-size: 15px
  font-weight: 700
  font-style: normal
  line-height: 21px
  text-align: center
  box-shadow: 0 0 0 1.5px white
  pointer-events: none

.ai-ok
  background: #66bb6a

.ai-info-mark
  background: #1e88e5
  font-family: Georgia, serif

.ai-excl
  background: #ff8f00
</style>
