import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// The web build has no Disconnect: the lobby IS the app there and web is online-play only, so
// going offline leaves nothing to do. Connect must still appear when not connected, for the
// case where the automatic connect did not get through.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const online = fs.readFileSync(path.join(DIR, 'online.vue'), 'utf8').split(CR).join('')
const template = online.slice(0, online.indexOf('<' + 'script>'))

describe('the connect / disconnect pair', () => {
  it('hides Disconnect on web', () => {
    expect(template).toMatch(/<v-btn v-if="!isWeb"[^>]*@click="disconnect\(\)"/)
  })

  it('still offers Disconnect on desktop', () => {
    expect(template).toContain('@click="disconnect()"')
  })

  it('still offers Connect when not connected', () => {
    expect(template).toMatch(/v-else[^>]*@click="connect\(\)"/)
  })

  it('keeps the v-else paired with "connected", not with the web check', () => {
    // gating the button alone would leave v-else attached to it, so Connect would show
    // while already connected
    const at = template.indexOf('@click="disconnect()"')
    const before = template.slice(0, at)
    expect(before.lastIndexOf('<template v-if="connected">'))
      .toBeGreaterThan(before.lastIndexOf('v-if="connected"', before.lastIndexOf('<template v-if="connected">') - 1))
  })

  it('wraps the pair so exactly one of the two can render', () => {
    const block = template.slice(template.indexOf('<template v-if="connected">'))
    const closeTemplate = block.indexOf('</template>')
    const velse = block.indexOf('v-else')
    expect(closeTemplate).toBeGreaterThan(-1)
    expect(velse).toBeGreaterThan(closeTemplate)
  })
})
