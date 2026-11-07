import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// On a narrow screen the action bar has no room for worded buttons side by side, so every one of
// them shows a Font Awesome icon instead. That swap lives in ActionButton; these assertions keep
// the phase panels using it rather than drifting back to a bare <v-btn> with a label, which would
// silently overflow the bar on a phone. There is no component-test harness in this project.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '')
const SCRIPT_OPEN = '<' + 'script>'
const template = src => src.slice(0, src.indexOf(SCRIPT_OPEN))

const PANELS = fs.readdirSync(DIR).filter(f => f.endsWith('.vue') && f !== 'ActionButton.vue')

describe('ActionButton', () => {
  const src = read('./ActionButton.vue')

  it('shows the icon only on a small screen', () => {
    expect(template(src)).toMatch(/<v-icon v-if="small"/)
  })

  it('shows the label otherwise', () => {
    expect(template(src)).toContain('{{ label }}')
  })

  it('keeps the words available to hover and to a screen reader', () => {
    // the icon replaces the text visually, not semantically
    expect(template(src)).toContain(':aria-label="label"')
    expect(template(src)).toContain('small ? label : null')
  })

  it('takes its breakpoint from the one shared definition', () => {
    expect(src).toContain("from '@/utils/small-screen'")
  })
})

describe('the action panels', () => {
  // image buttons - a meeple or a neutral figure is already its own icon
  const FIGURE_ONLY = ['RemoveMageOrWitchAction.vue', 'SelectPrisonerToExchangeAction.vue']

  it.each(PANELS.filter(f => !FIGURE_ONLY.includes(f)))('%s has no worded v-btn left', f => {
    const tpl = template(read('./' + f))
    const worded = [...tpl.matchAll(/<v-btn[^>]*>\s*\{\{[^}]*\$t\(/g)]
    expect(worded.map(m => m[0])).toEqual([])
  })

  it.each(PANELS)('%s registers ActionButton if it uses one', f => {
    const src = read('./' + f)
    if (!template(src).includes('<ActionButton')) return
    expect(src).toContain("import ActionButton from '@/components/game/actions/ActionButton'")
    expect(src).toMatch(/components:\s*\{[^}]*ActionButton/s)
  })

  it.each(PANELS)('%s gives every ActionButton both an icon and a label', f => {
    const tpl = template(read('./' + f))
    for (const tag of tpl.match(/<ActionButton[\s\S]*?\/>/g) || []) {
      expect(tag, tag).toMatch(/\bicon=/)
      expect(tag, tag).toMatch(/\blabel=/)
    }
  })
})

describe('the shared breakpoint', () => {
  it('matches $small-screen-max-width in shared.sass', () => {
    const js = fs.readFileSync(path.join(DIR, '../../../utils/small-screen.js'), 'utf8')
    const sass = fs.readFileSync(path.join(DIR, '../../../assets/styles/shared.sass'), 'utf8')
    const fromJs = js.match(/max-width:\s*(\d+)px/)[1]
    const fromSass = sass.match(/\$small-screen-max-width:\s*(\d+)px/)[1]
    expect(fromJs).toBe(fromSass)
  })
})
