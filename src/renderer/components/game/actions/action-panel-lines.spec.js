import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Small screens (≤ 960px): with many actions the items are no longer shrunk to fit — they take a
// line of their own above the buttons, that line scrolls sideways, and the bar grows (what sits
// below follows its height). Wider screens keep the one-line bar with the items scaled by count.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const read = file => fs.readFileSync(path.join(DIR, file), 'utf8').split(String.fromCharCode(13)).join('')
const phase = read('ActionPhaseAction.vue')
const panel = read('../ActionPanel.vue')
const events = read('../PlayEvents.vue')
const game = read('../../../pages/game.vue')
const NL = String.fromCharCode(10)

describe('action panel with many actions', () => {
  it('small screens no longer shrink the items; wider screens still do', () => {
    // no count-based shrink rule targets small screens any more
    expect(phase).not.toContain('@media (max-width: 960px)' + NL + '  section.size-')
    expect(phase).not.toContain('@media (max-width: 800px)')
    // wider screens keep them, and the short-screen 0.6 scale is limited to them too
    expect(phase).toContain('@media (max-height: 800px) and (min-width: 961px)')
    expect(phase).toContain('@media (min-width: 961px) and (max-width: 1060px)' + NL + '  section.size-max')
    expect(phase).toContain('[`size-$' + '{items.length}`]: true')
    // every count-based rule is limited to wider screens, so none leaks below 961px
    const wide = phase.slice(phase.indexOf('// --- wider screens'))
    for (const q of wide.match(/^@media [^\n]+$/gm)) expect(q, q).toContain('min-width: 961px')
  })

  it('small screens: a round slot as tall as the bar, the item inside at 80%', () => {
    const small = phase.slice(phase.indexOf('@media (max-width: 960px)' + NL + '  section'), phase.indexOf('// --- wider screens'))
    expect(small).toContain('    width: var(--action-bar-height)' + NL + '    height: var(--action-bar-height)')
    expect(small).toContain('    > *' + NL + '      transform: scale(0.8)')
  })

  it('decides two lines on small screens only', () => {
    expect(phase).toContain("import { isSmallScreen } from '@/utils/small-screen'")
    expect(phase).toContain('if (!isSmallScreen()) {')
  })

  it('puts the items and the buttons in rows of their own; the items row scrolls on small screens', () => {
    expect(phase).toContain('<div ref="itemsRow" class="items-row" @scroll.passive="updateScrollHints">')
    expect(phase).toContain('<div ref="buttonsRow" class="buttons-row">')
    const small = phase.slice(phase.indexOf('@media (max-width: 960px)' + NL + '  section'))
    expect(small).toContain('  .items-row' + NL + '    overflow-x: auto')
  })

  it('switches to two lines when items + buttons do not fit, and tells the panel', () => {
    expect(phase).toContain('const twoLines = buttons > 0 && itemsInner.scrollWidth + buttons + 8 > available')
    expect(phase).toContain("this.$emit('two-lines', twoLines)")
    expect(phase).toContain('  section.two-lines' + NL + '    flex-direction: column')
    expect(panel).toContain('@two-lines="twoLines = $event"')
    expect(panel).toContain('  &.two-lines' + NL + '    height: auto')
  })

  it('keeps clear of the web burger button on small screens', () => {
    expect(panel).toContain('    &.web' + NL + '      padding-right: 56px')
  })

  it('publishes its height for what sits below it', () => {
    expect(panel).toContain("document.documentElement.style.setProperty('--action-panel-height', h + 'px')")
    expect(panel).toContain("this.$store.commit('board/actionPanelHeight', h)")
    expect(events).toContain('const panel = this.$store.state.board.actionPanelHeight')
    expect(game).toContain('top: var(--action-panel-height, var(--action-bar-height))')
  })
})
