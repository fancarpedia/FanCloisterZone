import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'default.vue'), 'utf8')
const start = src.indexOf('    gameTitle () {')
const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
// eslint-disable-next-line no-new-func
const gameTitle = new Function(body)

const t = key => ({
  'game-setup.open-game.untitled-game': 'untitled game',
  'index.online.online-game': 'Online game',
  'index.online.local-game': 'Local game'
})[key]
const ctx = (route, game, connectionType) => ({
  $route: { name: route },
  $store: { state: { game, networking: { connectionType } } },
  $t: t
})

describe('the window title of a game', () => {
  it('starts with the game name and online / local', () => {
    expect(gameTitle.call(ctx('game', { id: 'g1', name: 'Friday game' }, 'online'))).toBe('Friday game — Online game · ')
    expect(gameTitle.call(ctx('game', { id: 'g1', name: 'Solo' }, 'direct'))).toBe('Solo — Local game · ')
  })

  it('an unnamed game says so', () => {
    expect(gameTitle.call(ctx('open-game', { id: 'g1', name: null }, 'online'))).toBe('untitled game — Online game · ')
  })

  it('nothing outside a game', () => {
    expect(gameTitle.call(ctx('online', { id: 'g1', name: 'x' }, 'online'))).toBe('')
    expect(gameTitle.call(ctx('game', { id: null, name: null }, 'online'))).toBe('')
  })

  it('is put in front of the title and follows a rename', () => {
    expect(src).toContain('const title = `$' + '{this.pageTitle()}$' + '{this.gameTitle()}$' + '{base}`')
    expect(src).not.toContain('parts.join')
    expect(src).toContain("'$store.state.game.name' () {")
  })
})

describe('the title of the dev tools', () => {
  const ps = src.indexOf('    pageTitle () {')
  // eslint-disable-next-line no-new-func
  const pageTitle = new Function(src.slice(src.indexOf('{', ps) + 1, src.indexOf('\n    },', ps)))
  const ctx = name => ({ $route: { name }, $t: k => ({ 'dev.test-runner': 'Test Runner', 'dev.theme-inspector': 'Theme Inspector' })[k] })

  it('names the Test Runner and the Theme Inspector', () => {
    expect(pageTitle.call(ctx('test-runner'))).toBe('Test Runner · ')
    expect(pageTitle.call(ctx('theme-inspector'))).toBe('Theme Inspector · ')
    expect(pageTitle.call(ctx('online'))).toBe('')
  })

  it('goes through Nuxt’s head, so the default head title no longer overwrites it', () => {
    expect(src).toContain('return this.windowTitle ? { title: this.windowTitle } : {}')
    expect(src).toContain('this.windowTitle = title')
  })
})
