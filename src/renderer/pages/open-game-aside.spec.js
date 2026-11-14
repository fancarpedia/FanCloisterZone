import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'open-game.vue'), 'utf8')
const style = src.slice(src.indexOf('<style'))

// the `order:` of a top-level rule in the page's style ("\n.selector\n  ...\n  order: N")
const order = selector => {
  const start = style.indexOf('\n' + selector + '\n')
  const next = style.indexOf('\n\n', start + 1)
  const block = style.slice(start, next)
  return Number(block.match(/ {2}order: (\d+)/)[1])
}

describe('the slot page side column', () => {
  it('reads Options, then Chat, then the game setup', () => {
    expect(order('.options')).toBe(1)
    expect(order('.chat-section')).toBe(2)
    expect(order('.game-setup-overview')).toBe(3)
  })

  it('in the markup too', () => {
    const options = src.indexOf('class="options"')
    const chat = src.indexOf('class="chat-section"')
    const setup = src.indexOf('<GameSetupOverview')
    expect(options).toBeLessThan(chat)
    expect(chat).toBeLessThan(setup)
  })
})
