import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// A loaded local game starts by itself once every seat is assigned; a new game still waits for
// the owner's Start.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(DIR, 'open-game.vue'), 'utf8').split(String.fromCharCode(13)).join('')
const computed = name => {
  const start = src.indexOf('    ' + name + ' () {')
  return src.slice(start, src.indexOf('\n    },', start))
}

describe('open-game auto start', () => {
  it('starts a loaded, not-online game the owner can start', () => {
    const cond = computed('shouldAutoStart')
    expect(cond).toContain('this.readOnly && this.isOwner && this.canStart &&')
    expect(cond).toContain("this.$store.state.networking.connectionType !== 'online'")
  })

  it('uses the same condition as the Start button, and waits for the game to arrive', () => {
    expect(src).toContain(':disabled="!canStart"')
    const can = computed('canStart')
    expect(can).toContain('if (!this.slots) return false')
    expect(can).toContain('this.ai ? (this.slotsReservedByAI && this.slotsReserved) : this.slotsAssigned')
  })

  it('starts once, as soon as the condition holds', () => {
    expect(src).toContain('shouldAutoStart: {\n      immediate: true,')
    expect(src).toContain('if (val && !this.autoStarted) {\n          this.autoStarted = true\n          this.startGame()')
  })
})
