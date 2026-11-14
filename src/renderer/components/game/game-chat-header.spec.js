import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'GameChat.vue'), 'utf8')

describe('the game chat looks like the global chat', () => {
  it('a bullet + title row with the close button on the right', () => {
    expect(src).toContain('<span class="chat-title"><span class="chat-bullet" />{{ $t(\'chat.game-chat\') }}</span>')
    expect(src).toMatch(/<div class="chat-header">[\s\S]*class="chat-close"[\s\S]*<\/div>/)
  })

  it('the global chat panel size and header style, in red', () => {
    expect(src).toContain('border-bottom: 2px solid #d32f2f')
    expect(src).toContain('text-transform: uppercase')
    expect(src).toContain('CHAT_WIDTH: 360,')
    expect(src).toContain('CHAT_HEIGHT: 280,')
    expect(src).toMatch(/\.game-chat\n {2}width: 360px\n {2}height: 280px/)
  })

  it('messages, input and send button laid out like the global chat', () => {
    expect(src).toContain('<div ref="gameChatMessages" class="chat-messages">')
    expect(src).toContain('class="chat-input"')
    expect(src).toMatch(/\.chat-send\n {4}border: none\n {4}border-radius: 5px\n {4}padding: 6px 10px/)
    expect(src).toMatch(/\.chat-message\n {4}display: flex\n {4}align-items: baseline\n {4}gap: 5px\n {4}margin-bottom: 4px\n {4}font-size: 13px/)
    // the old panel was all bold; the unread badge stays bold, like the global chat's
    const panel = src.slice(src.indexOf('\n.game-chat\n'))
    expect(panel).not.toContain('font-weight: bold')
  })
})
