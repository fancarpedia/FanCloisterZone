// Adding a language means touching FOUR places, and missing one fails quietly:
//
//   src/renderer/locales/<code>.json          the strings
//   src/renderer/nuxt.config.js   i18n.locales   or the file is never bundled
//   src/renderer/constants/locales.js            or the picker never offers it
//   src/renderer/plugins/vuei18n.js getPluralCode or plural strings render raw pipes
//
// Ukrainian was added with three of the four and simply did not load, which is what this guards.
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const RENDERER = path.resolve(__dirname, '..')
const read = (...p) => fs.readFileSync(path.join(RENDERER, ...p), 'utf8')
const uniq = a => [...new Set(a)].sort()
const matchAll = (text, re) => [...text.matchAll(re)].map(m => m[1])

const localeFiles = uniq(
  fs.readdirSync(path.join(RENDERER, 'locales'))
    .filter(f => /^[a-z]{2}(-[A-Za-z]+)?\.json$/.test(f))
    .map(f => f.replace(/\.json$/, ''))
)
const nuxtLocales = uniq(matchAll(read('nuxt.config.js'), /code: '([a-z-]+)'/g))
const pickerLocales = uniq(matchAll(read('constants', 'locales.js'), /id: '([a-z-]+)'/g))
const pluralLocales = uniq(matchAll(read('plugins', 'vuei18n.js'), /case '([a-z-]+)':/g))

describe('locale registration', () => {
  it('has at least the languages we know about', () => {
    expect(localeFiles.length).toBeGreaterThanOrEqual(14)
    expect(localeFiles).toContain('en')
  })

  it('bundles every locale file in nuxt.config i18n.locales', () => {
    expect(nuxtLocales).toEqual(localeFiles)
  })

  it('offers every locale file in the language picker', () => {
    expect(pickerLocales).toEqual(localeFiles)
  })

  it('has a pluralization rule for every locale file', () => {
    expect(pluralLocales).toEqual(localeFiles)
  })

  it('points each nuxt locale at a file that exists', () => {
    const cfg = read('nuxt.config.js')
    for (const file of matchAll(cfg, /file: '([a-z-]+\.json)'/g)) {
      expect(fs.existsSync(path.join(RENDERER, 'locales', file)), file).toBe(true)
    }
  })

  it('gives every picker entry a flag that exists in flags.svg', () => {
    const flags = uniq(matchAll(read('assets', 'flags.svg'), /symbol id="([^"]+)"/g))
    for (const flag of matchAll(read('constants', 'locales.js'), /flag: '([^']+)'/g)) {
      expect(flags, flag).toContain(flag)
    }
  })
})
