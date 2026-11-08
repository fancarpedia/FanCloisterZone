import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Clicking the aside toggled the player supply from ANYWHERE in it - including the empty space
// below the panels and the variant banner - so the supply collapsed for no apparent reason. Only
// the toggle button and the player panels should do it.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').split(CR).join('')
const game = read('game.vue')
const panel = read('../components/game/PlayerPanel.vue')

// the handler's rule, as game.vue implements it: a fake event whose target reports which
// ancestors it has
const clickOn = (...ancestors) => {
  const target = { closest: sel => (ancestors.includes(sel.replace('.', '')) ? {} : null) }
  // mirrors onAsideClick
  if (!target || !target.closest) return false
  if (!target.closest('.player-panel') || target.closest('.item-prisoner')) return false
  return true
}

describe('what toggles the supply', () => {
  it('a click on a player panel does', () => {
    expect(clickOn('player-panel')).toBe(true)
  })

  it('a click on something inside a panel does', () => {
    expect(clickOn('player-panel', 'name-box')).toBe(true)
  })
})

describe('what does NOT', () => {
  it('the aside\'s own empty space', () => {
    expect(clickOn()).toBe(false)
  })

  it('the variant banner, which lives in the aside but is not a panel', () => {
    expect(clickOn('game-variant')).toBe(false)
  })

  it('the deck counter area or anything else that is not a panel', () => {
    expect(clickOn('tile-pack-size')).toBe(false)
  })

  it('a captured meeple inside a panel - that pays a ransom instead', () => {
    expect(clickOn('player-panel', 'item-prisoner')).toBe(false)
  })
})

// Blocking the TOGGLE was only half of it. The aside is bounded top and bottom on small screens,
// so the empty strip below the last panel still swallowed the touch and the board never saw it -
// you could not place a tile there at all. The strip has to let events through.
describe('the empty strip below the panels', () => {
  const asideRule = game.slice(game.indexOf(String.fromCharCode(10) + 'aside' + String.fromCharCode(10)))
    .slice(0, 900)

  it('does not intercept pointer events', () => {
    expect(asideRule).toContain('pointer-events: none')
  })

  it('gives them back to the children that are interactive', () => {
    expect(asideRule).toMatch(/> \*\s+pointer-events: auto/)
  })

  it('declares none on the aside BEFORE auto on the children', () => {
    expect(asideRule.indexOf('pointer-events: none'))
      .toBeLessThan(asideRule.indexOf('pointer-events: auto'))
  })

  it('still bounds the aside top and bottom, which is why the strip exists', () => {
    // if this ever stops being true the strip is gone and so is the need for the rule
    expect(game).toContain('bottom: $panel-gap')
  })
})

describe('how it is wired', () => {
  it('requires the click to be inside a panel, rather than excluding a list of things', () => {
    expect(game).toContain("if (!target.closest('.player-panel') || target.closest('.item-prisoner'))")
  })

  it('no longer toggles for anything that is not a prisoner', () => {
    expect(game).not.toMatch(/if \(target && target\.closest && target\.closest\('\.item-prisoner'\)\) \{\s*\n\s*return\s*\n\s*\}\s*\n\s*this\.togglePlayerSupply\(\)/)
  })

  it('gives the panel the stable class the rule matches on', () => {
    expect(panel).toContain('class="player-panel"')
  })

  it('leaves the toggle button toggling directly, with its own stopPropagation', () => {
    expect(game).toContain('@click.stop="togglePlayerSupply"')
  })
})
