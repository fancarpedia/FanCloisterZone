<template>
  <div class="app-update-box">
    <div v-if="download" class="download">
      <v-progress-linear
        v-if="download.size"
        :value="download.size ? download.progress / download.size * 100 : null"
      />
      <v-progress-linear v-else indeterminate />
    </div>
    <div v-if="updateInfo" class="update-box">
      <InstallerDownloader
        :fileURL="isWin ? updateInfo.assetUrl.exe : isMac ? updateInfo.assetUrl.dmg : updateInfo.assetUrl.appImage"
        :titleText="$t('index.update.new-version-available')"
        :downloadButtonText="$t('index.update.download')"
        :installButtonText="$t('index.update.install-new-version')"
        :installerErrorText="$t('index.update.download-error')"
        :startingText="$t('index.update.starting')"
      />

      <h4>{{ $t('index.update.release-notes') }}</h4>
      <div class="update-release-notes">
        <div v-html="updateInfo.releaseNotes" />
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

import InstallerDownloader from '@/components/InstallerDownloader'

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

export default {
  components: {
    InstallerDownloader
  },

  data () {
    return {
      isMac,
      isWin
    }
  },

  computed: {
    ...mapState({
      download: state => state.download,
      updateInfo: state => state.updateInfo
    })
  }
}
</script>

<style lang="sass" scoped>
.download
  padding: 0 20px

.update-box
  padding: 20px
  color: black
  text-align: center

  +theme using ($theme)
    background-color: map-get($theme, 'update-box-backgrouncolor')

  .update-action
    margin: 20px 0

  .update-note
    font-style: italic
    margin-bottom: 10px

  .update-release-notes
    max-height: 25vh
    overflow: auto
    text-align: left

    &::-webkit-scrollbar
      width: 8px
      height: 8px

    &::-webkit-scrollbar-track
      background: #f0f0f0
      border-radius: 10px

    &::-webkit-scrollbar-thumb
      background: linear-gradient(180deg, #4e9af1, #0056b3)
      border-radius: 10px

      &:hover
        background: linear-gradient(180deg, #66b2ff, #007bff)

  ::v-deep ul
    list-style: none

  ::v-deep a
    color: white
</style>
