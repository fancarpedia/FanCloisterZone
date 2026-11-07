import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

  it('marks its separator with the same class as the button', () => {
    // otherwise a bare "or" is left behind wherever the button is hidden
    const rotateBlock = tpl.slice(tpl.indexOf('v-if="canRotatePlacedTile"'), tpl.indexOf('undoAllowed"'))
    const separator = rotateBlock.match(/<span class="([^"]*)">\{\{ \$t\('game\.action\.or'\) \}\}/)
    expect(separator).not.toBeNull()
    expect(separator[1].split(/\s+/)).toContain('rotate-placed')
  })

  it('hides anything marked rotate-placed by default', () => {
    expect(panel).toMatch(/\.rotate-placed\n {2}display: none/)
  })

  it('shows it only inside the small-screen media query', () => {
    const media = panel.slice(panel.indexOf('@media (max-width: $small-screen-max-width)'))
    expect(media).toMatch(/\.rotate-placed\n {4}display: block/)
  })

  it('drops the separators entirely on small screens', () => {
    // which is what turns "Confirm or Rotate or Undo" into "Confirm Rotate Undo"
    const media = panel.slice(panel.indexOf('@media (max-width: $small-screen-max-width)'))
    expect(media).toMatch(/span\.skip-text\n {8}display: none/)
  })
})
