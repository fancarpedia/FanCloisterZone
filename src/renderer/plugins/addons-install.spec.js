import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fsExtra from 'fs-extra'
import { describe, it, expect } from 'vitest'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8')

describe('cross-device add-on installation (EXDEV)', () => {
  it('stages unpacked add-ons next to addonsFolder and cleans up temp folder in finally', () => {
    const addonsSrc = read('addons.js')
    expect(addonsSrc).toContain("path.join(path.dirname(addonsFolder), '.addon-tmp-')")
    expect(addonsSrc).toContain('await moveAddonDirectory(tmpAddonPath, destPath)')
    expect(addonsSrc).toMatch(/finally\s*\{\s*await fs\.promises\.rm\(tmpFolder/)
  })

  it('falls back to fs.move when rename fails with EXDEV across mount points', async () => {
    const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fcz-exdev-test-'))
    try {
      const srcDir = path.join(tmpRoot, 'src-addon')
      const destDir = path.join(tmpRoot, 'dest-addon')
      await fs.promises.mkdir(srcDir, { recursive: true })
      await fs.promises.writeFile(path.join(srcDir, 'jcz-addon.json'), JSON.stringify({ version: 1 }))

      let moveCalled = false
      const mockFs = {
        promises: {
          async rename () {
            const err = new Error('EXDEV: cross-device link not permitted')
            err.code = 'EXDEV'
            throw err
          }
        },
        async move (s, d) {
          moveCalled = true
          return fsExtra.move(s, d)
        }
      }

      // Extract moveAddonDirectory body directly so we don't pull Electron into Node vitest
      const addonsSrc = read('addons.js')
      const start = addonsSrc.indexOf('export async function moveAddonDirectory')
      const fnBody = addonsSrc.slice(addonsSrc.indexOf('{', start) + 1, addonsSrc.indexOf('\n}\n', start))
      // eslint-disable-next-line no-new-func
      const moveAddonDirectory = new Function('srcPath', 'destPath', 'fsImpl', `return (async () => { ${fnBody} })()`)

      await moveAddonDirectory(srcDir, destDir, mockFs)
      expect(moveCalled).toBe(true)
      const movedJson = JSON.parse(await fs.promises.readFile(path.join(destDir, 'jcz-addon.json'), 'utf8'))
      expect(movedJson.version).toBe(1)
      await expect(fs.promises.access(srcDir)).rejects.toThrow()
    } finally {
      await fs.promises.rm(tmpRoot, { recursive: true, force: true })
    }
  })

  it('rethrows non-EXDEV rename errors', async () => {
    const addonsSrc = read('addons.js')
    const start = addonsSrc.indexOf('export async function moveAddonDirectory')
    const fnBody = addonsSrc.slice(addonsSrc.indexOf('{', start) + 1, addonsSrc.indexOf('\n}\n', start))
    // eslint-disable-next-line no-new-func
    const moveAddonDirectory = new Function('srcPath', 'destPath', 'fsImpl', `return (async () => { ${fnBody} })()`)

    const mockFs = {
      promises: {
        async rename () {
          const err = new Error('EACCES: permission denied')
          err.code = 'EACCES'
          throw err
        }
      },
      async move () {
        throw new Error('should not call move')
      }
    }

    await expect(moveAddonDirectory('/a', '/b', mockFs)).rejects.toThrow('EACCES')
  })
})

describe('game window readiness is never blocked by network add-on downloads', () => {
  it('skips classic auto-download in game windows and guards missing download links', () => {
    const addonsSrc = read('addons.js')
    expect(addonsSrc).toContain('if (isWeb() || (this.ctx.$windows && this.ctx.$windows.isGameWindow())) return')
    expect(addonsSrc).toContain('if (!link) {')
  })

  it('runs updateOutdatedAddons in the background without blocking loadAddons or game-window.ready', () => {
    const layoutSrc = read('../layouts/default.vue')
    expect(layoutSrc).toContain('this.$addons.updateOutdatedAddons().catch(')
    expect(layoutSrc).not.toContain('await this.$addons.updateOutdatedAddons()')
    expect(layoutSrc).toContain("ipcRenderer.send('game-window.ready')")
  })
})
