// @vitest-environment jsdom
//
// The player's identity (clientId + secret) owns their seats in open online games. If the web
// settings ever read back without it (storage evicted, a damaged blob after a restart), the store
// would mint a new one and every open game would show the player as an observer. The browser stub
// keeps a backup of just the identity and restores it.
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('web-build player identity backup', () => {
  let electron
  const get = () => electron.ipcRenderer.invoke('settings.get')
  const save = data => electron.ipcRenderer.invoke('settings.save', data)

  beforeEach(async () => {
    vi.resetModules()
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    electron = await import('./electron.js')
  })

  it('backs the identity up on every save', async () => {
    await save({ clientId: 'abc', secret: 's3cret', nickname: 'Betty' })
    expect(JSON.parse(window.localStorage.getItem('fcz.identity'))).toEqual({ clientId: 'abc', secret: 's3cret' })
  })

  it('restores it when the settings are gone (evicted / cleared)', async () => {
    await save({ clientId: 'abc', secret: 's3cret', nickname: 'Betty' })
    window.localStorage.removeItem('fcz.settings')
    const { settings } = await get()
    expect(settings.clientId).toBe('abc')
    expect(settings.secret).toBe('s3cret')
  })

  it('restores it when the stored settings are damaged', async () => {
    await save({ clientId: 'abc', secret: 's3cret', nickname: 'Betty' })
    window.localStorage.setItem('fcz.settings', '{"clientId": "ab')
    const { settings } = await get()
    expect(settings.clientId).toBe('abc')
    expect(settings.secret).toBe('s3cret')
  })

  it('fills in a missing secret or id but keeps the rest of the settings', async () => {
    await save({ clientId: 'abc', secret: 's3cret', nickname: 'Betty' })
    window.localStorage.setItem('fcz.settings', JSON.stringify({ nickname: 'Betty', theme: 'dark' }))
    const { settings } = await get()
    expect(settings).toMatchObject({ clientId: 'abc', secret: 's3cret', nickname: 'Betty', theme: 'dark' })
  })

  it('leaves a complete identity alone and seeds the backup on first run', async () => {
    window.localStorage.setItem('fcz.settings', JSON.stringify({ clientId: 'xyz', secret: 'k', nickname: 'John' }))
    const { settings } = await get()
    expect(settings.clientId).toBe('xyz')
    expect(JSON.parse(window.localStorage.getItem('fcz.identity'))).toEqual({ clientId: 'xyz', secret: 'k' })
  })

  it('a brand-new browser still starts without one (the store creates it)', async () => {
    const { settings } = await get()
    expect(settings).toBeNull()
  })

  it('does not keep the dev-mode suffix in the backup', async () => {
    await save({ clientId: 'abc--2', secret: 's3cret' })
    expect(JSON.parse(window.localStorage.getItem('fcz.identity')).clientId).toBe('abc')
  })
})
