import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'PlayEvents.vue'), 'utf8')

describe('the history scrolls by touch (web build on phones)', () => {
  it('listens for a finger drag on the turn rows, kept from the board', () => {
    expect(src).toContain('@touchstart.passive.stop="onTouchStart"')
    expect(src).toContain('@touchmove.stop="onTouchMove"')
    expect(src).toContain('@touchend.passive.stop="onTouchEnd"')
    expect(src).toContain('touch-action: none')
  })

  it('drag and wheel share the same clamped scroll', () => {
    const methods = src.slice(src.indexOf('scrollBy (delta)'))
    expect(methods).toContain('this.offset = Math.min(Math.max(0, this.offset + delta), Math.max(0, maxOffset))')
    expect(methods).toContain('this.scrollBy(ev.deltaY / 3)')
    expect(methods).toContain('this.scrollBy(this._touchY - y)')
    expect(methods).toContain('if (ev.cancelable) ev.preventDefault()')
  })
})
