import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

const layout = read('../layouts/default.vue')
const menu = read('../../main/modules/menu.js')
const online = read('online.vue')
const status = read('../components/OnlineStatus.vue')

describe('main menu: create / join online, new local game', () => {
  it('has the three items, Create Game on Ctrl/Cmd+N and New Local Game on Ctrl/Cmd+Shift+N', () => {
    expect(menu).toContain("id: 'create-online-game', label: $t('menu.create-game') || 'Create Game', accelerator: 'CommandOrControl+N'")
    expect(menu).toContain("$t('menu.new-local-game') || 'New Local Game', accelerator: 'CommandOrControl+Shift+N'")
    expect(menu).toContain("$t('menu.join-online-game') || 'Join Online Game', accelerator: 'CommandOrControl+J'")
  })

  it('online items only on the online page while connected; a local game whenever no game is open', () => {
    expect(layout).toContain("const onlineReady = routeName === 'online' && this.onlineConnected &&")
    expect(layout).toContain("'create-online-game': onlineReady,")
    expect(layout).toContain("'join-game': onlineReady,")
    expect(layout).toContain("'new-game': !gameOpen && this.engine?.ok,")
  })

  it('the online page answers the online items', () => {
    expect(layout).toContain("this.$root.$emit('online.create-game')")
    expect(layout).toContain("this.$root.$emit('online.join-game')")
    expect(online).toContain("this.$root.$on('online.create-game', this._onMenuCreate)")
    expect(online).toContain("this.$root.$on('online.join-game', this._onMenuJoin)")
    expect(online).toContain("this.$root.$off('online.create-game', this._onMenuCreate)")
  })
})

describe('the online page', () => {
  it('has no local games section (new / open game are in the main menu)', () => {
    expect(online).not.toContain('local-group')
    expect(online).not.toContain('showLocalGameDialog')
    expect(online).not.toContain('loadLocalGame')
  })

  it('does not say "connected to …"', () => {
    expect(status).not.toContain('index.online.connected-to')
    expect(status).toContain('index.online.connecting')
    expect(status).toContain('index.online.offline')
  })
})
