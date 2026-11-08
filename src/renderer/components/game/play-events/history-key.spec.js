import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Dev builds tag each history event with where it sits in the raw state, so a tile seen in the
// strip can be found in `history` without counting rows by hand. Hovering the tile shows it.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').split(CR).join('')

const playEvents = read('../PlayEvents.vue')
const tileEvent = read('./TilePlacedEvent.vue')
const tileImage = read('../StandaloneTileImage.vue')

// what PlayEvents does, as a function of the flag - the labelling itself, isolated
const label = (devMode, turnIndex, eventIndex) =>
  devMode ? `history[${turnIndex}].events[${eventIndex}]` : undefined

describe('the key shown on hover', () => {
  it('names the turn and the event', () => {
    expect(label(true, 12, 3)).toBe('history[12].events[3]')
  })

  it('is the first event of the first turn for the very first key', () => {
    expect(label(true, 0, 0)).toBe('history[0].events[0]')
  })

  it('is absent outside dev builds', () => {
    expect(label(false, 12, 3)).toBeUndefined()
  })
})

describe('how it is wired', () => {
  it('is built only when devMode is on', () => {
    expect(playEvents).toContain('const devMode = this.$store.state.settings.devMode')
    expect(playEvents).toMatch(/if \(devMode\) \{\s*\n\s*ev = \{ \.\.\.ev, historyKey:/)
  })

  it('copies the event rather than writing into store state', () => {
    expect(playEvents).toContain('ev = { ...ev, historyKey:')
  })

  it('uses the index of the ORIGINAL array', () => {
    // big top moves are skipped further down; the key must not shift because of them
    expect(playEvents).toContain('item.events.forEach((ev, evIdx) =>')
    const build = playEvents.indexOf('historyKey:')
    const skip = playEvents.indexOf("startsWith('bigtop.')")
    expect(build).toBeLessThan(skip)
  })

  it('reaches the tile as a hover title', () => {
    expect(tileEvent).toContain(':title="ev.historyKey"')
  })

  it('renders it as a <title> child, which is what an svg shows', () => {
    // a title ATTRIBUTE on an svg element produces no tooltip
    expect(tileImage).toContain('<title v-if="title">{{ title }}</title>')
    expect(tileImage).toMatch(/title: \{ type: String, default: null \}/)
  })
})
