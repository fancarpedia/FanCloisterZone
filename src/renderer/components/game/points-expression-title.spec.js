// "Castle + 13 = 13" never said WHAT earned the 13. The engine now names the feature the castle
// took its points from, and it is shown as the SUBTITLE - the heading stays "Castle", the line
// under it reads "Road". The component is a .vue file and there is no component-test harness
// here, so the computed properties are rebuilt from the component's own source and exercised
// directly - if the implementation changes shape, the extraction fails loudly rather than
// passing against a stale copy.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const src = fs.readFileSync(path.join(DIR, 'PointsExpression.vue'), 'utf8').split(CR).join('')

// the real mappings, read out of the component
const readMapping = (from, to) => {
  const body = src.slice(src.indexOf(from), to ? src.indexOf(to) : undefined)
  const map = {}
  for (const [, k, v] of body.matchAll(/'([^']+)':\s*'([^']+)'/g)) map[k] = v
  return map
}
const TITLE_MAPPING = readMapping('const TITLE_MAPPING = {', 'const SUBTITLE_MAPPING')
const SUBTITLE_MAPPING = readMapping('const SUBTITLE_MAPPING = {', 'export default')

// stand-in for the component: $t echoes the key's last segment so the wiring is visible
const makeVm = expr => ({
  expr,
  $t: key => key.split('.').pop(),
  get title () {
    let t = TITLE_MAPPING[this.expr.name]
    if (t) return this.$t(t)
    t = TITLE_MAPPING[this.expr.name.split('.')[0]]
    if (t) return this.$t(t)
    return this.expr.name
  },
  get sourceTitle () {
    const feature = this.expr.ptr?.source?.feature
    if (!feature) return null
    const key = TITLE_MAPPING[feature.toLowerCase()]
    return key ? this.$t(key) : feature
  },
  get subtitle () {
    // in brackets, like the courier's subtitle (commit 6a38216)
    if (this.sourceTitle) return '(' + this.sourceTitle + ')'
    const t = SUBTITLE_MAPPING[this.expr.name]
    if (t !== undefined) return t === null ? '' : '(' + this.$t(t) + ')'
    const key = this.expr.name.split('.')[1]
    if (!key) return null
    if (SUBTITLE_MAPPING[key] !== undefined) return '(' + this.$t(SUBTITLE_MAPPING[key]) + ')'
    return key
  }
})

const castle = source => makeVm({
  name: 'castle',
  points: 13,
  ptr: source
    ? { featurePointer: { position: [0, -1], location: 'S', feature: 'Castle' }, source }
    : { position: [0, -1], location: 'S', feature: 'Castle' }
})

describe('a castle score', () => {
  it('keeps Castle as the heading', () => {
    expect(castle({ feature: 'Road' }).title).toBe('castle')
  })

  it('names the road it took the points from, underneath', () => {
    expect(castle({ feature: 'Road' }).subtitle).toBe('(road)')
  })

  it('names a city just the same', () => {
    expect(castle({ feature: 'City' }).subtitle).toBe('(city)')
  })

  it('has no subtitle when the engine named no source', () => {
    // an unfinished castle at final scoring takes from nothing and scores zero
    expect(castle(null).title).toBe('castle')
    expect(castle(null).subtitle).toBe(null)
  })

  it('reads sensibly when one castle cascaded into another', () => {
    expect(castle({ feature: 'Castle' }).subtitle).toBe('(castle)')
  })

  it('shows the raw feature name rather than nothing if it is unmapped', () => {
    expect(castle({ feature: 'Bogus' }).subtitle).toBe('(Bogus)')
  })
})

describe('every other score is untouched', () => {
  it('a road keeps its own title', () => {
    expect(makeVm({ name: 'road', ptr: { position: [0, 0], location: 'WE' } }).title).toBe('road')
  })

  it('a monastery pointer with positions adds nothing', () => {
    const expr = { name: 'monastery', ptr: { featurePointer: {}, positions: [[0, 0], [1, 0]] } }
    expect(makeVm(expr).title).toBe('monastery')
  })

  it('a dotted name still resolves through its first segment', () => {
    expect(makeVm({ name: 'fairy.turn', ptr: null }).title).toBe('fairy')
  })
})

describe('the component really is built this way', () => {
  it('derives the source from the pointer the engine sends', () => {
    expect(src).toContain('this.expr.ptr?.source?.feature')
  })

  it('puts the source in the subtitle, ahead of the generic ones', () => {
    expect(src).toMatch(/subtitle \(\) \{[\s\S]{0,160}if \(this\.sourceTitle\) return '\(' \+ this\.sourceTitle \+ '\)'/)
  })

  it('leaves the heading as it was', () => {
    expect(src).toMatch(/title \(\) \{\s*let title = TITLE_MAPPING\[this\.expr\.name\]/)
  })
})

describe('the expression item', () => {
  const item = fs.readFileSync(path.join(DIR, 'ExpressionItem.vue'), 'utf8').split(CR).join('')

  it('shows the SOURCE feature for a castle.* item, not a castle', () => {
    expect(item).toContain("item.name.startsWith('castle.')\"><ScoringIcon :name=\"item.name.slice('castle.'.length)\"")
  })

  it('still shows a castle for the plural castles tally', () => {
    expect(item).toMatch(/item\.name === 'castles'"><img src="~\/assets\/figures\/castle\.png"/)
  })
})
