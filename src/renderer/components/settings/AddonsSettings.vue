<template>
  <div>
    <h3 class="mt-2 mb-4">{{ $t('settings.add-ons.title') }}</h3>

    <v-alert
      v-if="gameOpen"
      type="warning"
    >
      {{ $t('settings.add-ons.installation-is-not-allowed-during-game') }}
      <br><br>
      {{ $t('settings.add-ons.finish-or-leave-game-to-make-changes') }}
    </v-alert>

    <v-sheet
      v-else
      :class="{ dragzone: true, dragover: dragover }"
      @dragover.prevent="onDragover"
      @dragleave="onDragleave"
      @drop="onDrop"
      @click="selectFile"
    >
      <strong>{{ $t('settings.add-ons.install-add-on') }}</strong>
      <div>{{ $t('settings.add-ons.drag-add-on-here-or-click-here') }}</div>
    </v-sheet>

    <v-alert
      v-model="showAlert"
      class="install-error"
      type="warning"
      dismissible
    >
      <div v-for="(error, idx) in errors" :key="idx">{{ error }}</div>
    </v-alert>

	<i18n path="settings.add-ons.look-at-jcz-for-add-ons" tag="p" class="info-box">
	  <template #link>
	    <a href="https://www.carcassonneforum.cz/thread-4160.html" @click.prevent="openLink">Carcassonne CZ</a><!-- /* Fan Edition */ -->,

	    <a href="https://www.carcassonnecentral.com/community/index.php?action=downloads;cat=30" @click.prevent="openLink">Carcassonne Central Forum</a><!-- /* Fan Edition */ -->
	  </template>
    </i18n>
    
    <h4>{{ $t('settings.add-ons.available-new-add-ons') }}</h4>
    <div
      v-for="addon in availableAddonsList"
      class="available-addon"
      @click="installDownloadable(addon.key,addon.versions[0].version)"
    >
      <div>
        <strong>{{ addon.name }}</strong> <small class="addon-version">v{{ addon.versions[0].version }}</small>
      </div>
      <div>
        {{ addon.description }}
      </div>
    </div>
    <div v-if="!availableAddons">
      {{ $t('settings.add-ons.not-available-new-add-ons') }}
    </div>
    
    <h4>{{ $t('settings.add-ons.installed-add-ons') }}</h4>

    <AddonBox
      v-for="addon in getAddons()"
      :key="addon.id"
      :addon="addon"
      :disabled="gameOpen"
      @uninstall="uninstall(addon)"
    />
  </div>
</template>

<script>
import { shell, ipcRenderer } from 'electron'
import AddonBox from '@/components/settings/AddonBox'
import AddonsReloadObserverMixin from '@/components/AddonsReloadObserverMixin'

const JCA_FILTERS = [{ name: 'JCloisterZone add-on ', extensions: ['jca'] }]

export default {
  components: {
    AddonBox
  },

  mixins: [AddonsReloadObserverMixin],

  data () {
    return {
      showAlert: false,
      errors: [],
      dragover: false,
      availableAddonsList: []
    }
  },

  computed: {
    availableAddons() {
      return this.availableAddonsList.length>0
    },

    gameOpen () {
      const routeName = this.$route.name
      return routeName === 'game-setup' || routeName === 'open-game' || routeName === 'game'
    },

    addons () {
      // hide default
      return this.$addons.addons.filter(addon => !addon.hidden)
    }
  },

  methods: {
    onDragover () {
      this.dragover = true
    },

    onDragleave () {
      this.dragover = false
    },

    async onDrop ($ev) {
      const dt = $ev.dataTransfer
      const files = Array.from(dt.items)
        .map(it => it.getAsFile())
        .filter(it => it !== null)
        .filter(({ name }) => {
          const ext = name.split('.').pop()
          return ext === 'jca'
        })
        .map(f => f.path)
      await this.install(files)
      this.dragover = false
    },

    async selectFile () {
      const { filePaths } = await ipcRenderer.invoke('dialog.showOpenDialog', {
        title: 'Install add-on',
        filters: JCA_FILTERS,
        properties: ['openFile']
      })
      this.install(filePaths)
    },

    async installDownloadable (addon, version) {
      try {
        await this.$addons.installDownloadable(addon, version)
	    this.loadAvailableAddons()
      } catch (e) {
        this.showAlert = true
        this.errors.push(e + '')
      }
    },

    async install (files) {
      this.showAlert = false
      this.errors = []
      if (files.length) {
        for (const f of files) {
          try {
            await this.$addons.install(f)
            this.loadAvailableAddons()
          } catch (e) {
            this.showAlert = true
            this.errors.push(e + '')
          }
        }
      }
    },

    async uninstall (addon) {
      await this.$addons.uninstall(addon)
      await this.loadAvailableAddons()
    },

    openLink (ev) {
      shell.openExternal(ev.target.href)
    },

    afterAddonsReloaded () {
      this.$forceUpdate()
    },

    getAddons () {
      // hide default
      return this.$addons.addons.filter(addon => !addon.hidden)
    },
    
    async loadAvailableAddons () {
      const installed = this.$addons.addons.map(a => a.id)
      const downloadable = await this.$addons.getDownloadable()

      this.availableAddonsList = downloadable
        .filter(addon => !installed.includes(addon.key))
        .map(addon => ({
          ...addon,
          name: this.$te(`expansion.${addon.key}`) ? this.$t(`expansion.${addon.key}`) : addon.name,
          description: this.$te(`expansion.${addon.key}-description`) ? this.$t(`expansion.${addon.key}-description`) : addon.description
        }));
    }
  },
  
  mounted() {
    this.$addons.on('change', () => {
      this.loadAvailableAddons()
    })
    this.loadAvailableAddons()
  }
}
</script>

<style lang="sass" scoped>
.dragzone
  width: 100%
  height: 90px
  border: 2px dashed
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  font-weight: 300
  font-size: 18px
  cursor: pointer
  text-align: center

  strong
    display: block
    margin-bottom: 4px

  div
    font-size: 16px

  +theme using ($theme)
    color: map-get($theme, 'cards-selected-text')
    border-color: map-get($theme, 'cards-selected-text')

  &.dragover
    +theme using ($theme)
      background: map-get($theme, 'cards-selected-bg')

.info-box
  margin-top: 10px
  line-height: 1.2

.install-error
  margin-top: 10px
  
.available-addon
  margin-top: 10px
  padding: 5px 16px
  cursor: pointer
  
  +theme using ($theme)
    background: map-get($theme, 'board-bg')

.addon-version
  margin-left: 8px
  opacity: 0.4

</style>
