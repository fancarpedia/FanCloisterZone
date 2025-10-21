<template>
  <div class="downloader">
    <h2>{{ titleText }}</h2>

    <!-- Download Button -->
    <v-btn
      v-if="!isLinux && !downloading && !downloaded"
      color="primary"
      @click="startDownload"
    >
      {{ downloadButtonText }}
    </v-btn>

    <div class="update-action" v-if="isLinux">
      <v-btn v-if="!updating" color="secondary" @click="updateApp">{{ $t('index.update-to', { version: updateInfo.version }) }}</v-btn>
      <v-progress-linear v-else-if="updateProgress === null" indeterminate />
      <v-progress-linear v-else :value="updateProgress" />
    </div>

    <!-- Progress Bar -->
    <div v-if="downloading" class="progress-container">
      <progress :value="progress" max="100"></progress>
      <span>{{ progress.toFixed(1) }}%</span>
    </div>


    <!-- Run Installer -->
    <v-btn
      v-if="downloaded"
      color="success"
      @click="runInstaller"
      :disabled="installing"
    >
      <v-icon v-if="installing" class="spinning-icon" left>
        fas fa-spinner
      </v-icon>
      {{ installing ? startingText : installButtonText }}
    </v-btn>

  </div>
</template>

<script>
const { ipcRenderer } = require('electron')

const isLinux = process.platform === 'linux'

export default {
  name: 'InstallerDownloader',
  props: {
    fileURL: {
      type: String,
      required: true
    },
    titleText: {
      type: String,
      default: 'Installer Downloader'
    },
    downloadButtonText: {
      type: String,
      default: 'Download Installer'
    },
    installButtonText: {
      type: String,
      default: 'Run Installation'
    },
    installerErrorText: {
      type: String,
      default: 'Installer error'
    },
    startingText: {
      type: String,
      default: 'Starting...'
    }
    
  },
  data () {
    return {
      isLinux,
      updateProgress: state => state.updateProgress, // Linux
      updating: false, // Linux
      progress: 0,
      downloading: false,
      downloaded: false,
      downloadedFilePath: null,
      uid: null,
      installing: false
    }
  },
  methods: {
    updateApp () {
      // For Linux due to not need signed installation files
      this.updating = true
      ipcRenderer.send('do-update')
    },

    startDownload () {
      if (!this.fileURL) {
        console.error('[InstallerDownloader] fileURL prop is required')
        alert('Error: fileURL prop is required')
        return
      }
      
      console.log('[InstallerDownloader] Starting download:', this.fileURL)
      console.log('[InstallerDownloader] UID:', this.uid)
      
      this.downloading = true
      this.progress = 0

      const payload = { url: this.fileURL, id: this.uid }
      console.log('[InstallerDownloader] Sending payload:', payload)
      
      ipcRenderer.send('installer.download-file', payload)
    },
    runInstaller () {
      if (this.downloadedFilePath) {
        console.log('[InstallerDownloader] Running installer:', this.downloadedFilePath)
        this.installing = true
        ipcRenderer.send('installer.run', this.downloadedFilePath)
      } else {
        console.error('[InstallerDownloader] No file path available')
        alert('Error: No downloaded file found')
      }
    }
  },
  mounted () {
    // Generate a unique ID for this instance
    this.uid = 'installer-' + Math.random().toString(36).substr(2, 9)

    console.log('[InstallerDownloader] Component mounted')
    console.log('[InstallerDownloader] UID:', this.uid)
    console.log('[InstallerDownloader] fileURL:', this.fileURL)

    ipcRenderer.on('download-progress', (event, data) => {
      console.log('[InstallerDownloader] Progress event received:', data)
      if (data && data.id === this.uid) {
        console.log('[InstallerDownloader] Progress matched UID:', data.percent)
        this.progress = data.percent
      } else {
        console.log('[InstallerDownloader] Progress UID mismatch:', data?.id, 'vs', this.uid)
      }
    })

    ipcRenderer.on('download-complete', (event, data) => {
      console.log('[InstallerDownloader] Complete event received:', data)
      if (data && data.id === this.uid) {
        console.log('[InstallerDownloader] Download complete:', data.filePath)
        this.downloading = false
        this.downloaded = true
        this.downloadedFilePath = data.filePath
      }
    })

    ipcRenderer.on('download-error', (event, data) => {
      console.error('[InstallerDownloader] Error event received:', data)
      if (data && data.id === this.uid) {
        console.error('[InstallerDownloader] Download error:', data.errorMessage)
        this.downloading = false
        alert('Download error: ' + data.errorMessage)
      }
    })

    ipcRenderer.on('installer.error', (event, errorMessage) => {
      console.error('[InstallerDownloader] Installer error:', errorMessage)
      this.installing = false
      alert(this.installerErrorText + ': ' + errorMessage)
    })

    ipcRenderer.on('installer.started', (event) => {
      console.log('[InstallerDownloader] Installer started')
      // Keep installing = true to show it's running
    })
  },
  beforeDestroy () {
    console.log('[InstallerDownloader] Component destroying, removing listeners')
    ipcRenderer.removeAllListeners('download-progress')
    ipcRenderer.removeAllListeners('download-complete')
    ipcRenderer.removeAllListeners('download-error')
    ipcRenderer.removeAllListeners('installer.error')
  }
}
</script>

<style scoped>
.downloader {
  margin: 30px auto;
  text-align: center;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
}

progress {
  width: 100%;
  height: 20px;
}

.spinning-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>