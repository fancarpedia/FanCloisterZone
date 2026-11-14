<template>
  <!-- A country's flag (flag-icons, bundled: works offline and on Windows, where emoji flags
       show as two letters). Nothing at all for an unknown or missing code. The country's name, in
       the app language, is the tooltip. -->
  <img
    v-if="src"
    class="country-flag"
    :src="src"
    :alt="code"
    :title="countryName"
  >
</template>

<script>
// every 4:3 flag of flag-icons, keyed by lower-case code ("./sk.svg")
const FLAGS = require.context('flag-icons/flags/4x3', false, /\.svg$/)
const KNOWN = new Set(FLAGS.keys())

export const flagFile = code => {
  const c = String(code || '').trim().toLowerCase()
  return /^[a-z]{2}$/.test(c) ? `./${c}.svg` : null
}

export default {
  props: {
    // ISO 3166-1 alpha-2, e.g. "SK" (the server's GeoIP country)
    country: { type: String, default: null }
  },

  computed: {
    code () {
      return String(this.country || '').toUpperCase()
    },

    src () {
      const file = flagFile(this.country)
      if (!file || !KNOWN.has(file)) return null
      const asset = FLAGS(file)
      return asset && asset.default ? asset.default : asset
    },

    countryName () {
      try {
        const locale = this.$i18n && this.$i18n.locale ? this.$i18n.locale : undefined
        return new Intl.DisplayNames([locale, 'en'].filter(Boolean), { type: 'region' }).of(this.code)
      } catch (e) {
        return this.code
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.country-flag
  display: inline-block
  width: 1.33em
  height: 1em
  object-fit: cover
  vertical-align: -0.12em
  border-radius: 2px
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15)
  flex: 0 0 auto
</style>
