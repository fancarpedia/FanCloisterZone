import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')

describe('only one chat open at a time', () => {
  it('the global chat announces itself and closes for the game chat (overlay only)', () => {
    const src = read('GlobalChat.vue')
    expect(src).toContain("if (value) this.$root.$emit('chat-opened', 'global')")
    expect(src).toContain("if (which !== 'global' && !this.inline && this.open) this.open = false")
    expect(src).toContain("this.$root.$on('chat-opened', this.onOtherChatOpened)")
    expect(src).toContain("this.$root.$off('chat-opened', this.onOtherChatOpened)")
  })

  it('the game chat announces itself and closes for the global chat', () => {
    const src = read('game/GameChat.vue')
    expect(src).toContain("if (value) this.$root.$emit('chat-opened', 'game')")
    expect(src).toContain("if (which !== 'game' && this.open) this.closeChat()")
    expect(src).toContain("this.$root.$on('chat-opened', this.onOtherChatOpened)")
    expect(src).toContain("this.$root.$off('chat-opened', this.onOtherChatOpened)")
  })

  it('each chat opens above its own launcher, both launchers stay visible and toggle', () => {
    const g = read('GlobalChat.vue')
    expect(g).not.toContain('v-show="!open"')
    expect(g).toContain('@click="toggleChat"')
    expect(g).toMatch(/\.gc-panel\n {4}position: fixed\n {4}bottom: 88px/)
    const c = read('game/GameChat.vue')
    expect(c).toContain('v-show="!open || anchored"')
    expect(c).toContain('@click="onLauncherClick"')
    expect(c).toContain('anchored: isWeb(),')
    expect(c).toContain('if (this.anchored) return // sits above its launcher')
    expect(c).toMatch(/&\.anchored\n {4}right: calc\(var\(--aside-width-plus-gap\) \+ 16px\)\n {4}bottom: 88px/)
  })
})
