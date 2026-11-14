import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'TestResult.vue'), 'utf8')

describe('test results: Continue game', () => {
  it('has the button', () => {
    expect(src).toContain('@click="continueGame">{{ $nuxt.$t(\'dev.continue-game\') }}')
  })

  it('drops the results and the scenario, so the game plays on unchecked', () => {
    const start = src.indexOf('    continueGame () {')
    const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    }', start))
    const commit = vi.fn()
    // eslint-disable-next-line no-new-func
    new Function(body).call({ $store: { commit } })
    expect(commit.mock.calls).toEqual([['game/testScenario', null], ['game/testScenarioResult', null]])
  })
})
