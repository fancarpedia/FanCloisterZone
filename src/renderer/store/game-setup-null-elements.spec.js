import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { state as gameSetupState } from '@/store/gameSetup'

// `gameSetup.elements` is null until the setup store is initialised, and the components that read
// it index straight in - `elements.garden`, `elements['keep-building']`. Normally initialisation
// wins the race; a forced HMR reload re-mounts the page first and they throw
// "Cannot read properties of undefined (reading 'garden')". Default to {} at the mapState, the
// way GameElementButtons already does.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').split(CR).join('')

const READERS = [
  'components/game-setup/GameElementBox.vue',
  'components/game-setup/GameMechanicsBox.vue',
  'components/game-setup/tabs/FiguresTab.vue',
  'components/game-setup/tabs/RulesTab.vue',
  'components/game-setup/tabs/TimerTab.vue',
  'components/game-setup/tabs/VariantTab.vue',
  'pages/game-setup.vue'
]

describe('the state this guards against', () => {
  it('really does start as null', () => {
    expect(gameSetupState().elements).toBe(null)
  })

  it('and the reads that used to throw now survive it', () => {
    const elements = gameSetupState().elements || {}
    expect(() => elements.garden).not.toThrow()
    expect(!!elements['keep-building']).toBe(false)
    expect(elements.garden ? 2 : 1).toBe(1)
  })
})

describe.each(READERS)('%s', file => {
  const src = read(file)

  it('never INDEXES INTO gameSetup.elements without a fallback', () => {
    // passing the bare value along is fine - a watcher wants to see null turn into an object.
    // Only an immediate `.foo` or `['foo']` on a possibly-null value throws.
    const unguarded = [...src.matchAll(/state\.gameSetup\.elements\s*(\[|\.)/g)]
    expect(unguarded.map(m => src.slice(m.index, m.index + 60))).toEqual([])
  })

  it('keeps the value when the store IS initialised', () => {
    // the guard must be a fallback, not a replacement
    expect(src).toMatch(/state\.gameSetup\.elements \|\| \{\}/)
  })
})

describe('the shared breakpoint module', () => {
  const src = read('utils/small-screen.js')

  it('removes its listener on a hot swap', () => {
    // it subscribes at import time, so without this each swap leaves another listener behind
    expect(src).toContain('module.hot.dispose')
    expect(src).toMatch(/removeEventListener\('change', onChange\)/)
  })

  it('does not assume webpack is present', () => {
    // `module` is undefined outside webpack and would throw before anything could run
    expect(src).toContain("typeof module !== 'undefined' && module.hot")
  })
})
