import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// The test runner's Close returns to the lobby's home screen (/online, where the main window
// boots), not to the legacy landing page at '/'. A game window keeps '/'.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(DIR, 'test-runner.vue'), 'utf8').split(String.fromCharCode(13)).join('')
const close = src.slice(src.indexOf('async close() {'), src.indexOf('resetAll() {'))

describe('test runner Close', () => {
  it('routes to /online in the lobby window', () => {
    expect(close).toContain("this.$router.push(gameWindow ? '/' : '/online')")
    expect(close).not.toContain("this.$router.push('/')")
  })
})

describe('test runner name filter', () => {
  const computed = src.slice(src.indexOf('filteredTests () {'), src.indexOf('timerDisplay () {'))
  // the filter function itself, rebuilt from the page source and run against sample tests
  const body = computed.slice(computed.indexOf('{') + 1, computed.lastIndexOf('}'))
  // eslint-disable-next-line no-new-func
  const filter = (nameFilter, tests, selectedExpansions = []) => new Function(body).call({ nameFilter, tests, selectedExpansions })
  // test names are relative paths; on Windows their separator is a backslash
  const BS = String.fromCharCode(92)
  const MAGE = 'mage-and-witch' + BS + 'mage'
  const WITCH = 'mage-and-witch' + BS + 'witch'
  const WAGON = 'courier' + BS + 'courier-wagon'
  const tests = [
    { name: MAGE, requiredSets: ['basic', 'mage-and-witch'] },
    { name: WITCH, requiredSets: ['basic', 'mage-and-witch'] },
    { name: WAGON, requiredSets: ['basic', 'the-courier'] }
  ]
  const names = list => list.map(t => t.name)

  it('has a search field bound to nameFilter', () => {
    expect(src).toContain('v-model="nameFilter"')
    expect(src).toContain("$nuxt.$t('dev.filter-tests-by-name')")
  })

  it('shows everything without a filter', () => {
    expect(filter('', tests)).toHaveLength(3)
    expect(filter(null, tests)).toHaveLength(3)
  })

  it('matches case-insensitively, every word, a typed / matching the Windows separator', () => {
    expect(names(filter('WITCH', tests))).toEqual([MAGE, WITCH])
    expect(names(filter('mage witch/witch', tests))).toEqual([WITCH])
    expect(names(filter('witch' + BS + 'witch', tests))).toEqual([WITCH])
    expect(names(filter('courier wagon', tests))).toEqual([WAGON])
    expect(filter('nothing-like-this', tests)).toEqual([])
  })

  it('combines with the expansion filter', () => {
    expect(names(filter('mage', tests, ['the-courier']))).toEqual([])
    expect(names(filter('', tests, ['the-courier']))).toEqual([WAGON])
  })
})
