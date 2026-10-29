// @vitest-environment jsdom
//
// Ctrl+S / Ctrl+O in the web build. The renderer calls Electron's file dialogs and then plain
// fs.writeFile/readFile; the browser stubs have to answer in the SAME shape, because the callers
// destructure the result immediately. Returning the old default of `null` threw
// "Cannot destructure property 'filePath' of null" before the user saw anything.
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('web-build file dialogs', () => {
  let electron, fs

  beforeEach(async () => {
    vi.resetModules()
    window.URL.createObjectURL = vi.fn(() => 'blob:fake')
    window.URL.revokeObjectURL = vi.fn()
    electron = await import('./electron.js')
    fs = await import('./fs.js')
  })

  describe('showSaveDialog', () => {
    it('answers with Electron\'s shape so the caller can destructure it', async () => {
      window.prompt = vi.fn(() => 'my-game.jcz')
      const res = await electron.ipcRenderer.invoke('dialog.showSaveDialog', {
        title: 'Save Game',
        filters: [{ name: 'Saved games', extensions: ['jcz'] }]
      })
      // this is the line that used to throw
      const { filePath } = res
      expect(filePath).toBe('/download/my-game.jcz')
      expect(res.canceled).toBe(false)
    })

    it('suggests a name carrying the filter extension', async () => {
      window.prompt = vi.fn(() => 'x')
      await electron.ipcRenderer.invoke('dialog.showSaveDialog', {
        filters: [{ name: 'Saved games', extensions: ['jcz'] }]
      })
      expect(window.prompt.mock.calls[0][1]).toMatch(/\.jcz$/)
    })

    it('reports a cancel the way the callers test for it', async () => {
      window.prompt = vi.fn(() => null)
      const { filePath, canceled } = await electron.ipcRenderer.invoke('dialog.showSaveDialog', {})
      expect(canceled).toBe(true)
      expect(filePath).toBeFalsy() // callers do `if (filePath)`
    })

    it('does not let a typed name escape /download', async () => {
      window.prompt = vi.fn(() => '../../etc/passwd')
      const { filePath } = await electron.ipcRenderer.invoke('dialog.showSaveDialog', {})
      expect(filePath.startsWith('/download/')).toBe(true)
      expect(filePath).not.toContain('/etc/')
    })
  })

  describe('writing the chosen path', () => {
    it('exposes the callback form of writeFile that store/game.js uses', () => {
      expect(typeof fs.default.writeFile).toBe('function')
    })

    it('turns a /download write into a browser download', async () => {
      const click = vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const err = await new Promise(resolve => {
        fs.default.writeFile('/download/my-game.jcz', '{"a":1}', resolve)
      })
      expect(err).toBeNull()
      expect(click).toHaveBeenCalled()
      expect(window.URL.createObjectURL).toHaveBeenCalled()
    })

    it('still refuses a write outside /download and /userdata', async () => {
      await expect(fs.promises.writeFile('/resources/basic.xml', 'x')).rejects.toThrow(/read-only/)
    })
  })

  describe('opening a game', () => {
    it('round-trips a picked file through the virtual path', async () => {
      fs.putPickedFile('/download/game.jcz', '{"appVersion":"7.0.0"}')
      await expect(fs.promises.readFile('/download/game.jcz')).resolves.toBe('{"appVersion":"7.0.0"}')
    })

    it('reports ENOENT for a /download path nobody picked', async () => {
      await expect(fs.promises.readFile('/download/nope.jcz')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  describe('keyboard accelerators', () => {
    const pressCtrl = (key) => window.dispatchEvent(
      new window.KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true })
    )

    it('fires save-game when the menu has it enabled', async () => {
      const seen = vi.fn()
      electron.ipcRenderer.on('menu.save-game', seen)
      await electron.ipcRenderer.invoke('update-menu', { 'save-game': true })
      pressCtrl('s')
      expect(seen).toHaveBeenCalled()
    })

    it('stays silent while the menu has it disabled (lobby, no game)', async () => {
      const seen = vi.fn()
      electron.ipcRenderer.on('menu.save-game', seen)
      await electron.ipcRenderer.invoke('update-menu', { 'save-game': false })
      pressCtrl('s')
      expect(seen).not.toHaveBeenCalled()
    })

    it('swallows the key either way, so the browser Save Page dialog never opens', async () => {
      electron.ipcRenderer.on('menu.save-game', () => {})
      await electron.ipcRenderer.invoke('update-menu', { 'save-game': false })
      const ev = new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
      window.dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(true)
    })

    it('leaves the key alone while the user is typing', async () => {
      const seen = vi.fn()
      electron.ipcRenderer.on('menu.save-game', seen)
      await electron.ipcRenderer.invoke('update-menu', { 'save-game': true })
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 's', ctrlKey: true, bubbles: true, cancelable: true
      }))
      expect(seen).not.toHaveBeenCalled()
    })
  })
})
