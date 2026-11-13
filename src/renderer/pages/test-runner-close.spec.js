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
