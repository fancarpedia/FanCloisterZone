import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')
const FLAGS = path.join(dir, '../../../node_modules/flag-icons/flags/4x3')

describe('country flags (flag-icons)', () => {
  it('has a flag for the countries players come from, and Catalonia', () => {
    for (const c of ['sk', 'cz', 'de', 'gb', 'us', 'fr', 'es', 'pl', 'ua', 'es-ct']) {
      expect(fs.existsSync(path.join(FLAGS, c + '.svg'))).toBe(true)
    }
  })

  it('maps a GeoIP code to its flag file, nothing for a bad code', () => {
    const src = read('CountryFlag.vue')
    const body = src.slice(src.indexOf('export const flagFile'), src.indexOf('\n}\n', src.indexOf('export const flagFile')) + 2)
    // eslint-disable-next-line no-new-func
    const flagFile = new Function(body.replace('export const flagFile =', 'return'))()
    expect(flagFile('SK')).toBe('./sk.svg')
    expect(flagFile(' us ')).toBe('./us.svg')
    expect(flagFile(null)).toBe(null)
    expect(flagFile('XYZ')).toBe(null)
  })

  it('shows in the online players list and in the global chat', () => {
    expect(read('../pages/online.vue')).toContain('<CountryFlag :country="c.country" />')
    expect(read('GlobalChat.vue')).toContain('<CountryFlag :country="m.country" />')
  })
})
