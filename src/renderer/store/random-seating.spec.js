import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// A new game seats its players in random order by default — whether it is built on the setup page
// or created from a loaded setup (bookmark, my setups, popular / standard setups). A setup that
// states its own choice keeps it: the rematch passes randomizeSeating: false.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(DIR, 'gameSetup.js'), 'utf8').split(String.fromCharCode(13)).join('')
const rematch = fs.readFileSync(path.join(DIR, '../components/game/GameResultPanel.vue'), 'utf8')

// the loaded-setup branch of createGame, rebuilt and run on sample setups
const branch = src.slice(src.indexOf('      setup = {\n        ...loadedSetup,'), src.indexOf('      const rules = {}'))
// eslint-disable-next-line no-new-func
const fromLoaded = new Function('loadedSetup', 'let setup\n' + branch + '\nreturn setup')

describe('random seating by default', () => {
  it('is on for a game built on the setup page', () => {
    expect(src).toContain('    options: {\n      randomizeSeating: true,')
  })

  it('is on for a game created from a loaded setup without options', () => {
    expect(fromLoaded({ sets: { basic: 1 } }).options).toEqual({ randomizeSeating: true })
    expect(fromLoaded({ sets: {}, options: { puristTiles: true } }).options).toEqual({ randomizeSeating: true, puristTiles: true })
  })

  it('keeps a setup\'s own choice (the rematch turns it off)', () => {
    expect(fromLoaded({ options: { rematch: true, randomizeSeating: false } }).options)
      .toEqual({ randomizeSeating: false, rematch: true })
    expect(rematch).toContain('rematch: true, randomizeSeating: false')
  })

  it('keeps the rest of the loaded setup', () => {
    const setup = fromLoaded({ sets: { basic: 1 }, timer: { initial: 60 } })
    expect(setup.sets).toEqual({ basic: 1 })
    expect(setup.timer).toEqual({ initial: 60 })
  })
})
