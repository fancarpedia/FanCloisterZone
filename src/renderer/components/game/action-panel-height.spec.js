// @vitest-environment jsdom
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ActionPanel.vue'), 'utf8')

// pull a method / computed body out of the component and run it against a plain `this`
const fn = name => {
  const start = src.indexOf('    ' + name + ' (')
  const open = src.indexOf('{', start)
  const body = src.slice(open + 1, src.indexOf('\n    },', start))
  const args = src.slice(src.indexOf('(', start) + 1, src.indexOf(')', start))
  // eslint-disable-next-line no-new-func
  return new Function(args, body)
}
const publishHeight = fn('publishHeight')
const standInShown = fn('standInShown')

const ctx = (extra = {}) => {
  const commit = vi.fn()
  return {
    $el: { offsetHeight: 160 },
    $store: { commit, state: { board: { actionPanelHeight: 84 } } },
    commit,
    ...extra
  }
}

describe('a hovered history panel does not move the history (no hover loop)', () => {
  it('keeps the action height while a stand-in panel is shown', () => {
    const c = ctx({ standInShown: true })
    publishHeight.call(c)
    expect(c.commit).not.toHaveBeenCalled()
  })

  it('publishes the real height once the action is back', () => {
    const c = ctx({ standInShown: false })
    const setProperty = vi.spyOn(document.documentElement.style, 'setProperty')
    publishHeight.call(c)
    expect(c.commit).toHaveBeenCalledWith('board/actionPanelHeight', 160)
    setProperty.mockRestore()
  })

  it('every history panel counts as a stand-in', () => {
    for (const key of ['pointsExpression', 'returnedMeeplePanel', 'awardedMeeplePanel', 'returnedTokenPanel', 'diceRollPanel', 'placementPanel']) {
      expect(standInShown.call({ [key]: {} })).toBe(true)
    }
    expect(standInShown.call({})).toBe(false)
  })

  it('re-measures when the stand-in goes away', () => {
    expect(src).toMatch(/standInShown \(shown\) \{\n\s+if \(!shown\) this\.\$nextTick\(\(\) => this\.publishHeight\(\)\)/)
  })
})
