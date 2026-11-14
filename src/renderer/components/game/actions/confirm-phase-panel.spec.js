import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// The tile-placement confirmation panel must read:
//   large screens -> "Confirm or Undo"
//   small screens -> "Confirm Rotate Undo"
// It once read "Confirm or Undo Tile placement or or Undo": the phase drew its own Undo while
// ActionPanel's slot supplied a second one, and the Rotate separator stayed visible on large
// screens although the button it belongs to was hidden. There is no component-test harness in
// this project, so the structure is pinned at source level.
// normalised: these files are checked out with CRLF on Windows
const CR = String.fromCharCode(13)
const read = rel => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').split(CR).join('')

const confirm = read('./TilePlacementConfirmPhaseAction.vue')
const panel = read('../ActionPanel.vue')
// up to <script>, not the first </template> - these files nest <template v-if> elements
const SCRIPT_OPEN = '<' + 'script>'
const template = src => src.slice(0, src.indexOf(SCRIPT_OPEN))

describe('TilePlacementConfirmPhaseAction', () => {
  it('draws the Confirm button itself', () => {
    expect(template(confirm)).toContain("$t('button.confirm')")
  })

  it('does not draw its own Undo - the slot supplies it', () => {
    expect(template(confirm)).not.toContain("$t('button.undo')")
  })

  it('does not draw its own separator - the slot supplies those too', () => {
    expect(template(confirm)).not.toContain("$t('game.action.or')")
  })

  it('exposes the slot exactly once', () => {
    expect(template(confirm).match(/<slot\b/g)).toHaveLength(1)
  })
})

describe('the Rotate option in ActionPanel', () => {
  const tpl = template(panel)

  it('hides anything marked rotate-placed by default', () => {
    expect(panel).toMatch(/\.rotate-placed\n {2}display: none/)
  })

  it('shows it only inside the small-screen media query', () => {
    const media = panel.slice(panel.indexOf('@media (max-width: $small-screen-max-width)'))
    expect(media).toMatch(/\.rotate-placed\n {4}display: block/)
  })

  it('has no "or" separators at all: actions and buttons only', () => {
    // "Confirm Rotate Undo" on every screen size, no "or" / "or skip action" texts
    expect(panel).not.toContain('skip-text')
  })
})

describe('Rotate comes first in the action panel', () => {
  it('is drawn before the current action, not after Skip in its buttons', () => {
    const rotate = panel.indexOf('class="pass-item rotate-placed rotate-first"')
    const action = panel.indexOf(':is="actionComponent"')
    expect(rotate).toBeGreaterThan(-1)
    expect(rotate).toBeLessThan(action)
    // the action's own button slot no longer carries it
    expect(panel).toContain('v-if="action.canPass || undoAllowed"')
    expect(panel.match(/@click="rotatePlacedTile"/g)).toHaveLength(1)
  })

  it('only for the local player, hidden while a history panel stands in for the action', () => {
    expect(panel).toContain('v-if="action && local && !ai && canRotatePlacedTile"')
    const block = panel.slice(panel.indexOf('v-if="action && local && !ai && canRotatePlacedTile"'), panel.indexOf('class="pass-item rotate-placed rotate-first"'))
    expect(block).toContain('!pointsExpression')
    expect(block).toContain('!placementPanel')
  })
})

describe('Remove mage or witch', () => {
  it('shows the action panel buttons (Undo); Rotate comes first from the panel itself', () => {
    const remove = read('./RemoveMageOrWitchAction.vue')
    expect(template(remove)).toMatch(/<slot \/>\n {2}<\/section>/)
  })
})
