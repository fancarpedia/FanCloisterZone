<template>
  <v-chip
    class="ma-2"
    :color="color"
    label
    text-color="white"
    :title="url"
    @click.prevent="open"
  >
    <v-icon v-if="type === 'download'" left>fa-file-download</v-icon>
    <v-icon v-else-if="type === 'wiki'" left>fab fa-wikipedia-w</v-icon>
    <template v-else-if="site === 'wica'">
      <img src="~/assets/wica.png" width="29" height="29">&nbsp;
    </template>
    <template v-else-if="site === 'bgg'">
      <img src="~/assets/bgg.svg" width="60" height="29">&nbsp;
    </template>
    {{ $t(titlekey) }}
  </v-chip>
</template>

<script>
import { shell } from 'electron'

export default {
  props: {
    title: { type: String, default: null },
    href: { type: String, required: true },
    type: { type: String, default: null }
  },

  computed: {
    site () {
      if (this.href.startsWith('https://wikicarpedia.com') || this.href.startsWith('http://wikicarpedia.com')) {
        return 'wica'
      }
      if (this.href.startsWith('https://boardgamegeek.com')) {
        return 'bgg'
      }
      if (this.href.startsWith('https://www.hans')) {
        return 'hig'
      }
      return ''
    },

    color () {
      if (this.site === 'bgg') {
        return '#3f3a60'
      } else if (this.site === 'wica') {
        return '#2a66c2'
      } else if (this.site === 'hig') {
        return '#d19738'
      }
      return 'pink lighten-1'
    },
    
    url () {
      if (this.href.startsWith('https://wikicarpedia.com/index.php/') && !this.href.startsWith('https://wikicarpedia.com/index.php/Special:MyLanguage/')) {
        return this.href.replace('https://wikicarpedia.com/index.php/','https://wikicarpedia.com/index.php/Special:MyLanguage/')
      } else if (this.href.startsWith('https://wikicarpedia.com/car/') && !this.href.startsWith('https://wikicarpedia.com/car/Special:MyLanguage/')) {
        return this.href.replace('https://wikicarpedia.com/car/','https://wikicarpedia.com/car/Special:MyLanguage/')
      }
      return this.href
    },
    
    titlekey () {
      if (this.title == 'Rules') {
        return 'menu.rules'
      } else if (this.site == 'hig' && this.title == '©') {
        return 'HiG ©'
      } else {
        return this.title
      }
    }
  },

  methods: {
    open () {
      shell.openExternal(this.href)
    }
  }
}
</script>
