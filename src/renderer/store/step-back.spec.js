import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Dev menu "Step Back in Save": the current game minus the last message of its history, reloaded
// through the regular open-game path (load with an in-memory save instead of a file).
const DIR = path.dirname(fileURLToPath(import.meta.url))
const read = file => fs.readFileSync(path.join(DIR, file), 'utf8').split(String.fromCharCode(13)).join('')
const game = read('game.js')
const layout = read('../layouts/default.vue')
const menu = read('../../main/modules/menu.js')

describe('dev Step Back in Save', () => {
  const action = game.slice(game.indexOf('  async stepBack ('), game.indexOf('  async savescenario ('))

  it('drops the last history message and reloads from that save', () => {
    expect(action).toContain('const content = generateSaveContent(state, false)')
    expect(action).toContain('content.replay = content.replay.slice(0, -1)')
    expect(action).toContain("return dispatch('load', { saved: content, forceLocal: online })")
  })

  it('closes the running game quietly before loading, so the window is not sent home', () => {
    const close = action.indexOf("await dispatch('close', { redirect: false })")
    expect(close).toBeGreaterThan(-1)
    expect(close).toBeLessThan(action.indexOf("return dispatch('load'"))
    expect(close).toBeGreaterThan(action.indexOf('const content = generateSaveContent(state, false)'))
  })

  it('opens the step back of an online game in a new local game window, leaving the online one running', () => {
    expect(action).toContain("this._vm.$windows.openGame({ kind: 'load', payload: { saved: content, forceLocal: true } }, { force: true })")
    const opened = action.indexOf('this._vm.$windows.openGame(')
    expect(opened).toBeLessThan(action.indexOf("await dispatch('close', { redirect: false })"))
    expect(layout).toContain(': payload.saved ? { saved: payload.saved, forceLocal: !!payload.forceLocal } : {})')
  })

  it('works in any game: an online one is reloaded as a local copy', () => {
    expect(action).toContain("const online = rootState.networking.connectionType === 'online'")
    expect(action).not.toContain('not-possible-in-online-mode')
    expect(action).toContain('if (!state.id || !state.gameMessages || !state.gameMessages.length) return')
    // the online-history refusal is skipped, the copy replays locally, this player takes the human seats
    expect(game).toContain("if (rootState.networking.connectionType === 'online' && !rootState.runningTests && !forceLocal) {")
    expect(game).toContain('local: !!sg.test || rootState.runningTests || forceLocal')
    expect(game).toContain('slots.forEach(s => { if (sg.test || !s.ai) s.clientId = rootState.settings.clientId })')
  })

  it('load takes an in-memory save instead of a file', () => {
    expect(game).toContain('{ file: filePath, setupOnly = false, saved = null, forceLocal = false } = {}')
    expect(game).toContain('if (!filePath && !saved) {')
    expect(game).toContain('const data = saved ? JSON.stringify(saved) : await fs.promises.readFile(filePath)')
  })

  it('is in the Dev menu, enabled for any running game', () => {
    expect(menu).toContain("{ id: 'dev-step-back', label: $t('dev.step-back-in-save') || 'Step Back in Save'")
    expect(menu).toContain("'dev-step-back': false")
    expect(layout).toMatch(/'dev-step-back': gameRunning\n/)
    expect(layout).toContain("this.$store.dispatch('game/stepBack')")
  })
})
