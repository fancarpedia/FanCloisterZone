import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { getSystemLocale, setSystemLocale } from './system-locale'

const dir = path.dirname(fileURLToPath(import.meta.url))

describe('the system locale sent in HELLO', () => {
  it('is the OS locale once the settings bring it', () => {
    setSystemLocale('sk-SK')
    expect(getSystemLocale()).toBe('sk-SK')
  })

  it('falls back to the resolved locale before that (and in the web build)', () => {
    setSystemLocale(null)
    expect(getSystemLocale()).toBe(Intl.DateTimeFormat().resolvedOptions().locale)
  })

  it('is kept when the settings load and sent with HELLO', () => {
    expect(fs.readFileSync(path.join(dir, '../store/settings.js'), 'utf8')).toContain('setSystemLocale(systemLocale)')
    expect(fs.readFileSync(path.join(dir, '../plugins/connection.js'), 'utf8')).toContain('systemLocale: getSystemLocale(),')
  })
})
