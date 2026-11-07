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

// Anything dispatched through game/apply goes to the engine, so it must be in ENGINE_MESSAGES -
// networking.js filters on that set, and a type missing from it means the engine's reply is
// dropped and the move silently does nothing. ROTATE_TILE was missed exactly that way once.
// (Types sent straight to the server, e.g. GAME_CHAT or SYNC_GAME, do not go through apply.)
describe('ENGINE_MESSAGES', () => {
  it('carries every message type dispatched through apply', async () => {
    const { ENGINE_MESSAGES } = await import('@/constants/messages')
    const fs = await import('node:fs')
    const url = await import('node:url')
    const src = fs.readFileSync(url.fileURLToPath(new URL('../store/game.js', import.meta.url)), 'utf8')
    // GAME_FINISHED rides the same send path but is purely a server notification - the engine
    // never sees it and must not, since the game is already over.
    const SERVER_ONLY = new Set(['GAME_FINISHED'])
    const applied = [...src.matchAll(/dispatch\('apply',\s*\{[^}]*?type:\s*'([A-Z_]+)'/gs)].map(m => m[1])
    expect(applied.length).toBeGreaterThan(0)
    expect(applied.filter(t => !ENGINE_MESSAGES.has(t) && !SERVER_ONLY.has(t))).toEqual([])
  })

  it('includes ROTATE_TILE', async () => {
    const { ENGINE_MESSAGES } = await import('@/constants/messages')
    expect(ENGINE_MESSAGES.has('ROTATE_TILE')).toBe(true)
  })
})

// The protocol version is both the current and the minimum accepted one - the handshake compares
// it for exact equality, so bumping it refuses every older peer. Pinned so it cannot drift back
// by accident along with an unrelated edit to this file.
describe('NETWORK_PROTOCOL_COMPATIBILITY', () => {
  it('is 7.1.0 - the version that carries ROTATE_TILE', async () => {
    const { NETWORK_PROTOCOL_COMPATIBILITY } = await import('@/constants/versions')
    expect(NETWORK_PROTOCOL_COMPATIBILITY).toBe('7.1.0')
  })

  it('is the single value the handshake sends and checks', async () => {
    const fs = await import('node:fs')
    const url = await import('node:url')
    const read = p => fs.readFileSync(url.fileURLToPath(new URL(p, import.meta.url)), 'utf8')
    // no literal version numbers on either side of the wire - both read the constant
    expect(read('../plugins/connection.js')).toContain('protocolVersion: NETWORK_PROTOCOL_COMPATIBILITY')
    expect(read('../../main/modules/localServer.js')).toContain('NETWORK_PROTOCOL_COMPATIBILITY !== payload.protocolVersion')
  })
})

// The save gate must never sort ABOVE the app's own version, or the app refuses saves it has
// just written - semver puts 7.1.0-alpha.1 before 7.1.0, so a bare '7.1.0' here would do exactly
// that. This guards the pairing as package.json moves on.
describe('SAVED_GAME_COMPATIBILITY', () => {
  it('is 7.1.0-alpha.1', async () => {
    const { SAVED_GAME_COMPATIBILITY } = await import('@/constants/versions')
    expect(SAVED_GAME_COMPATIBILITY).toBe('7.1.0-alpha.1')
  })

  it('does not lock out saves written by this very build', async () => {
    const { SAVED_GAME_COMPATIBILITY } = await import('@/constants/versions')
    const { compare } = await import('compare-versions')
    const fs = await import('node:fs')
    const url = await import('node:url')
    const appVersion = JSON.parse(
      fs.readFileSync(url.fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8')
    ).version
    expect(compare(appVersion, SAVED_GAME_COMPATIBILITY, '<')).toBe(false)
  })

  it('still refuses saves from before the rotation protocol', async () => {
    const { SAVED_GAME_COMPATIBILITY } = await import('@/constants/versions')
    const { compare } = await import('compare-versions')
    for (const old of ['6.2.1', '6.3.0', '7.0.0']) {
      expect(compare(old, SAVED_GAME_COMPATIBILITY, '<')).toBe(true)
    }
  })
})
