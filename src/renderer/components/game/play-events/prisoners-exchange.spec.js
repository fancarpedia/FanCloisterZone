import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi } from 'vitest'

const dir = path.dirname(fileURLToPath(import.meta.url))
const read = f => fs.readFileSync(path.join(dir, f), 'utf8')
const src = read('PrisonersExchangeEvent.vue')

const fnStart = src.indexOf('export const exchangedPrisoners')
// eslint-disable-next-line no-new-func
const exchangedPrisoners = new Function(src.slice(fnStart, src.indexOf('\n}\n', fnStart) + 2).replace('export const exchangedPrisoners =', 'return'))()

const a = { type: 'SmallFollower', player: 0 }
const b = { type: 'BigFollower', player: 1 }

describe('a prisoners exchange in the history', () => {
  it('shows both exchanged followers (engine `followers`), in reverse order', () => {
    const ev = { followers: [a, b], exchange: [b, {}] }
    expect(exchangedPrisoners(ev)).toEqual([b, a])
    expect(ev.followers).toEqual([a, b]) // the event itself is not changed
  })

  it('falls back to the one follower an older engine sent', () => {
    expect(exchangedPrisoners({ exchange: [b, {}] })).toEqual([b])
  })

  it('each behind prison bars, the exchange between them', () => {
    expect(src).toContain('<svg class="prison-bars"')
    expect(src).toContain('<v-icon v-if="i > 0" :key="\'x\' + i">fas fa-exchange-alt</v-icon>')
  })

  it('hovered: the panel explains it with both followers', () => {
    const start = src.indexOf('    onMouseEnter () {')
    const body = src.slice(src.indexOf('{', start) + 1, src.indexOf('\n    },', start))
    const commit = vi.fn()
    // eslint-disable-next-line no-new-func
    new Function(body).call({ prisoners: [a, b], $store: { commit } })
    expect(commit).toHaveBeenCalledWith('board/placementPanel', {
      kind: 'exchanged',
      titleKey: 'game.placement.title.exchanged',
      subtitleKey: 'game.placement.exchanged-reason',
      prisoners: [a, b]
    })
    expect(read('../PlacementPanel.vue')).toContain('<div v-if="expr.prisoners" class="subject prisoners-exchange">')
  })

  it('the engine sends both followers', () => {
    const builder = fs.readFileSync(path.join(dir, '../../../../../../JCloisterZoneEngine/src/main/ts/com/jcloisterzone/engine/StateGsonBuilder.ts'), 'utf8')
    expect(builder).toContain('followers: [freed(ev.getFirst()), freed(ev.getSecond())]')
  })
})
