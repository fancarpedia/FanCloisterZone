import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'PlayerSlot.vue'), 'utf8')

// vitest here has no .vue loader: evaluate the component's <script> block on its own
const script = src.slice(src.indexOf('<script>') + 8, src.indexOf('</script>'))
  .replace(/^import .*$/gm, '')
  .replace('export default', 'return')
// eslint-disable-next-line no-new-func
const PlayerSlot = new Function('mapState', 'require', 'aiSupport', script)(() => ({}), () => '', setup => ({ ok: !!(setup && setup.aiOk) }))

// run a method / computed of PlayerSlot against a plain `this`
const run = (fn, ctx) => fn.call(ctx)
const store = () => ({ dispatch: vi.fn().mockResolvedValue(undefined), commit: vi.fn() })

describe('clicking a slot only takes or leaves it', () => {
  const toggle = PlayerSlot.methods.toggle

  it('an empty slot is taken as a human seat', () => {
    const $store = store()
    run(toggle, { number: 2, slotState: 'open', $store })
    expect($store.dispatch.mock.calls).toEqual([['gameSetup/takeSlot', { number: 2 }]])
  })

  it('my human seat is left, even in an AI game (no longer turned into an AI)', () => {
    const $store = store()
    run(toggle, { number: 1, slotState: 'local', setupAi: true, $store })
    expect($store.dispatch.mock.calls).toEqual([['gameSetup/releaseSlot', { number: 1 }]])
  })

  it('my AI seat is left', () => {
    const $store = store()
    run(toggle, { number: 1, slotState: 'localai', $store })
    expect($store.dispatch.mock.calls).toEqual([['gameSetup/releaseSlot', { number: 1 }]])
  })

  it('nothing when read-only or the empty seat is locked', () => {
    const $store = store()
    run(toggle, { number: 0, slotState: 'open', readOnly: true, $store })
    run(toggle, { number: 0, slotState: 'open', capReached: true, $store })
    expect($store.dispatch).not.toHaveBeenCalled()
  })
})

describe('the "AI player" button', () => {
  const makeAi = PlayerSlot.methods.makeAi
  const canMakeAi = PlayerSlot.computed.canMakeAi

  it('takes an empty seat, then hands it to the AI', async () => {
    const $store = store()
    await makeAi.call({ number: 3, slotState: 'open', canMakeAi: true, $store })
    expect($store.dispatch.mock.calls).toEqual([
      ['gameSetup/takeSlot', { number: 3 }],
      ['gameSetup/changeSlotToAi', { number: 3 }]
    ])
  })

  it('never switches a taken seat (human ↔ AI): one choice, on an empty seat', async () => {
    const $store = store()
    await makeAi.call({ number: 1, slotState: 'local', canMakeAi: true, $store })
    expect($store.dispatch).not.toHaveBeenCalled()
  })

  it('Assign / AI player sit only on an empty seat I may take', () => {
    const show = PlayerSlot.computed.showAiButton
    expect(run(show, { slotState: 'open' })).toBe(true)
    expect(run(show, { slotState: 'local' })).toBe(false)
    expect(run(show, { slotState: 'localai' })).toBe(false)
    expect(run(show, { slotState: 'remote' })).toBe(false)
    expect(run(show, { slotState: 'open', capReached: true })).toBe(false)
    expect(run(show, { slotState: 'open', readOnly: true })).toBe(false)
  })

  it('works in any game the AI can play (no separate AI game any more), greyed out otherwise', () => {
    expect(run(canMakeAi, { showAiButton: true, aiSupported: true })).toBe(true)
    expect(run(canMakeAi, { showAiButton: true, aiSupported: false })).toBe(false)
    expect(run(canMakeAi, { showAiButton: false, aiSupported: true })).toBe(false)
    const supported = PlayerSlot.computed.aiSupported
    expect(run(supported, { $store: { state: { game: { setup: { aiOk: true } } } } })).toBe(true)
    expect(run(supported, { $store: { state: { game: { setup: { aiOk: false } } } } })).toBe(false)
    expect(src).toContain(':disabled="!canMakeAi"')
    expect(src).toContain(":title=\"canMakeAi ? null : $t('game-setup.ai.not-available-hint')\"")
  })

  it('is a separate button on the slot, its click kept from the slot', () => {
    expect(src).toContain('v-if="showAiButton"')
    expect(src).toContain('@click.stop="makeAi"')
    expect(src).toContain("{{ $t('game-setup.create.ai-player') }}")
  })

  it('my own taken seat, human or AI, shows a Release button (same as clicking it)', () => {
    const show = PlayerSlot.computed.showReleaseButton
    expect(run(show, { slotState: 'local' })).toBe(true)
    expect(run(show, { slotState: 'localai' })).toBe(true)
    expect(run(show, { slotState: 'open' })).toBe(false)
    expect(run(show, { slotState: 'remote' })).toBe(false)
    expect(run(show, { slotState: 'local', readOnly: true })).toBe(false)
    expect(src).toMatch(/class="kick-btn release-btn"[\s\S]{0,120}@click\.stop="toggle"/)
    expect(src).toContain("{{ $t('game-setup.create.release-slot') }}")
  })

  it('an empty seat shows an Assign button beside it instead of the "click to assign" text', () => {
    expect(src).toContain("{{ $t('game-setup.create.assign') }}")
    expect(src).toMatch(/class="kick-btn assign-btn"[\s\S]{0,120}@click\.stop="toggle"/)
    expect(src).not.toContain("$t('game-setup.create.click-to-assign')")
  })
})

describe('slot buttons do not cover the name, and the slot is not taller for it', () => {
  // the slot's own style block, and the short-screen part of it
  const style = src.slice(src.indexOf('<style'))
  const wide = style.slice(0, style.indexOf('@media (max-height: 768px)'))
  const short = style.slice(style.indexOf('@media (max-height: 768px)'))
  const padding = block => block.match(/padding: (\d+)px 0 (\d+)px 0/).slice(1).map(Number)
  const gap = (block, sel) => Number(block.match(new RegExp(sel + '\\n\\s+(?:[^\\n]*\\n\\s+)*?margin-bottom: (\\d+)px'))[1])

  it('keeps room for the pinned buttons at the bottom', () => {
    expect(style).toMatch(/\.kick-wrapper\n\s+position: absolute\n\s+bottom: 8px/)
    expect(padding(wide)[1]).toBeGreaterThanOrEqual(32)
    expect(padding(short)[1]).toBeGreaterThanOrEqual(30)
  })

  // vertical space around the meeple / state / name: padding top + bottom + the gaps under the
  // meeple and the state. Before the slot buttons: 40 + 30 + 30 + 15 = 115, short screens 20 + 10 + 20 + 15 = 65.
  it('is shorter overall than before, on both screen sizes', () => {
    const [wt, wb] = padding(wide)
    expect(wt + wb + gap(wide, 'svg') + gap(wide, '\\.state')).toBeLessThan(115)
    const [st, sb] = padding(short)
    expect(st + sb + gap(short, 'svg') + gap(short, '\\.state')).toBeLessThan(65)
  })
})

describe('Assign and AI player look alike', () => {
  it('same colour, size and alignment; the tooltip wrapper adds no offset', () => {
    const assign = src.slice(src.indexOf('class="kick-btn assign-btn"'), src.indexOf('class="kick-btn assign-btn"') + 120)
    const ai = src.slice(src.indexOf('class="kick-btn ai-btn"'), src.indexOf('class="kick-btn ai-btn"') + 120)
    for (const btn of [assign, ai]) {
      expect(btn).toContain('x-small')
      expect(btn).toContain('color="secondary"')
    }
    expect(src).toMatch(/\.slot-actions\n\s+display: flex\n\s+align-items: center/)
    expect(src).toMatch(/\.ai-btn-tooltip\n\s+display: inline-flex\n\s+align-items: center/)
  })
})

describe('the online lobby marks AI seats', () => {
  it('a robot head on the meeple of each AI player, in both game lists', () => {
    const online = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../pages/online.vue'), 'utf8')
    expect(online.split('<v-icon v-if="s.ai" class="ai-head">fa-solid fa-robot</v-icon>')).toHaveLength(3)
    expect(online).toMatch(/\.ai-head\n\s+position: absolute/)
  })
})
