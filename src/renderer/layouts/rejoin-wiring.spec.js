import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Where the rejoin runs is the whole design. Joining a game sets the engine up from
// $tiles.xmls, which loadExpansions() only fills in during loadAddons(); an earlier attempt
// hung the rejoin off the lobby's "connected" watcher, joined before that, and died on
// "undefined is not iterable". Everything that joins a game sits after that await.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = p => fs.readFileSync(path.join(DIR, p), 'utf8').split(CR).join('')

const layout = read('default.vue')
const shim = read('../../../web-build/build.js')

describe('when the rejoin runs', () => {
  it('is after the tile definitions have loaded', () => {
    const loaded = layout.indexOf('await this.loadAddons()')
    const rejoin = layout.indexOf('await this.rejoinAfterReload()')
    expect(loaded).toBeGreaterThan(-1)
    expect(rejoin).toBeGreaterThan(loaded)
  })

  it('is before the launch intent, which joins games the same way', () => {
    const rejoin = layout.indexOf('await this.rejoinAfterReload()')
    expect(layout.indexOf('isGameWindow()', rejoin)).toBeGreaterThan(rejoin)
  })
})

describe('what it reuses', () => {
  const method = layout.slice(layout.indexOf('async rejoinAfterReload ()'))
    .slice(0, 1200)

  it('the same connect the launch intent uses', () => {
    expect(method).toContain('this.connectForGame({ fan: pending.entry !== ')
  })

  it('the same join the launch intent uses', () => {
    expect(method).toContain('this.joinOnlineGame({ gameId: pending.gameId })')
  })

  it('is web-only', () => {
    expect(method).toMatch(/if \(!isWeb\(\)\) \{/)
  })

  it('falls back to the lobby when the game cannot be rejoined', () => {
    expect(method).toContain("this.$router.push('/online')")
  })

  it('does not let a failure take the boot down with it', () => {
    expect(method).toMatch(/catch \(e\) \{[\s\S]{0,120}could not rejoin the game after reload/)
  })

  it('installs the hook even when there is nothing to rejoin', () => {
    expect(method.indexOf('installReloadHook(this.$store)'))
      .toBeLessThan(method.indexOf('takePendingRejoin()'))
  })
})

describe('the update bar', () => {
  it('calls the hook before reloading', () => {
    expect(shim).toContain('if(window.__fczBeforeReload)window.__fczBeforeReload()')
  })

  it('reloads even if the hook throws', () => {
    // the error bar has its own b.onclick earlier in the file; anchor on the update bar's
    const at = shim.indexOf('__fczBeforeReload')
    const onclick = shim.slice(shim.lastIndexOf('b.onclick=function(){', at), shim.indexOf('o.appendChild(b)', at))
    expect(onclick).toContain('try{')
    expect(onclick).toContain('catch(_){}')
    expect(onclick).toContain('location.replace(u)')
  })

  it('gives the close frame a moment to go out', () => {
    expect(shim).toContain('setTimeout(function(){location.replace(u)},150)')
  })

  it('reloads to a fresh cache key (?v=<new id>), keeping the rest of the URL and the route', () => {
    expect(shim).toContain('var u=location.pathname+(q?q+"&":"?")+"v="+encodeURIComponent(id)+location.hash;')
    expect(shim).toContain('bar(j.buildId)')
  })

  it('does not nag again when a reload still came back on the old build', () => {
    expect(shim).toContain('try{sessionStorage.setItem(KEY,id)}catch(_){}')
    expect(shim).toContain('if(tried&&tried===id){shown=true;console.warn(')
  })
})
