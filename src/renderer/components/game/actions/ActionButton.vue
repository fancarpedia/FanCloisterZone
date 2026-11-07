<template>
  <v-btn
    v-bind="$attrs"
    :title="small ? label : null"
    :aria-label="label"
    :class="{ 'icon-only': small }"
    v-on="$listeners"
  >
    <v-icon v-if="small" :small="!$attrs.large">{{ icon }}</v-icon>
    <template v-else>{{ label }}</template>
  </v-btn>
</template>

<script>
import { isSmallScreen } from '@/utils/small-screen'

// An action-bar button that shows its label on a roomy screen and a Font Awesome icon on a narrow
// one, where several of these have to fit side by side and the words no longer do. The label is
// kept as the title/aria-label, so the button is still identifiable by hover and to a screen
// reader - the icon replaces the text visually, not semantically.
export default {
  inheritAttrs: false,

  props: {
    // Font Awesome name, e.g. fa-check (Vuetify is configured with iconfont 'fa')
    icon: { type: String, required: true },
    label: { type: String, required: true }
  },

  computed: {
    small () {
      return isSmallScreen()
    }
  }
}
</script>

<style lang="sass" scoped>
// Square it off: with no label there is no text to pad around, and the stock 64px min-width makes
// three of these overflow the bar on a phone. The selector has to out-specify Vuetify's own
// `.v-btn:not(.v-btn--round).v-size--default`, hence the extra classes.
.icon-only.v-btn:not(.v-btn--round)
  &.v-size--default,
  &.v-size--large
    min-width: 0
    padding: 0 14px
</style>
