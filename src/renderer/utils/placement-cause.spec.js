import { describe, it, expect } from 'vitest'

import { causeHighlight, causeMeeple, causeTitle, withCause } from './placement-cause'
import en from '@/locales/en.json'

const get = key => key.split('.').reduce((o, k) => (o ? o[k] : undefined), en)
// a minimal i18n stand-in over en.json (vue-i18n named interpolation for {cause})
const vm = {
  $te: key => typeof get(key) === 'string',
  $t: (key, args) => String(get(key)).replace(/\{(\w+)\}/g, (_, k) => args[k])
}

const meeplePtr = { position: [2, 0], location: 'NW', feature: 'Road' }

describe('causeHighlight', () => {
  it('opens the placed tile', () => {
    expect(causeHighlight({ type: 'tile-placed', position: [1, -1] })).toEqual({ extraPoints: [], extraTiles: [[1, -1]] })
  })

  it('opens the deployed meeple spot, whatever the pointer shape', () => {
    const meeple = { id: '0.small-follower.1', type: 'SmallFollower', player: 0 }
    expect(causeHighlight({ type: 'meeple-deployed', pointer: meeplePtr, meeple }).extraPoints).toEqual([meeplePtr])
    expect(causeHighlight({ type: 'meeple-deployed', pointer: { featurePointer: meeplePtr, meepleId: 'x' }, meeple }).extraPoints).toEqual([meeplePtr])
  })

  it('opens where a moving figure went (tile or spot)', () => {
    expect(causeHighlight({ type: 'figure-moved', figure: 'dragon.1', pointer: [3, 3] }).extraTiles).toEqual([[3, 3]])
    expect(causeHighlight({ type: 'figure-moved', figure: 'bigtop.1', pointer: [0, 2] }).extraTiles).toEqual([[0, 2]])
  })

  it('has nothing to open for a rule or without a cause', () => {
    expect(causeHighlight({ type: 'rule', name: 'meteorite' })).toEqual({ extraPoints: [], extraTiles: [] })
    expect(causeHighlight(undefined)).toEqual({ extraPoints: [], extraTiles: [] })
  })
})

describe('withCause', () => {
  it('merges the openings into an emphasis, keeping its own', () => {
    const e = withCause({ type: 'tile', position: [0, 0], extraTiles: [[5, 5]] }, { type: 'tile-placed', position: [1, 1] })
    expect(e).toEqual({ type: 'tile', position: [0, 0], extraPoints: [], extraTiles: [[5, 5], [1, 1]] })
  })

  it('returns the emphasis untouched when the cause adds nothing', () => {
    const e = { type: 'tile', position: [0, 0] }
    expect(withCause(e, null)).toBe(e)
    expect(withCause(e, { type: 'rule', name: 'wolf' })).toBe(e)
  })
})

describe('causeMeeple', () => {
  it('gives the deployed meeple in EventMeeplesLayer shape', () => {
    const cause = { type: 'meeple-deployed', pointer: meeplePtr, meeple: { id: '1.small-follower.2', type: 'SmallFollower', player: 1 } }
    expect(causeMeeple(cause)).toEqual({ type: 'SmallFollower', player: 1, position: [2, 0], feature: 'Road', location: 'NW' })
  })

  it('is null for other causes', () => {
    expect(causeMeeple({ type: 'tile-placed', position: [0, 0] })).toBeNull()
    expect(causeMeeple(null)).toBeNull()
  })
})

describe('causeTitle', () => {
  it('names each kind of cause', () => {
    expect(causeTitle({ type: 'tile-placed', position: [0, 0] }, vm)).toBe('Caused by: the placed tile')
    expect(causeTitle({ type: 'meeple-deployed', pointer: meeplePtr, meeple: {} }, vm)).toBe('Caused by: the deployed meeple')
    expect(causeTitle({ type: 'rule', name: 'meteorite' }, vm)).toBe('Caused by: a meteorite impact')
  })

  it('has an English text for every rule the engine names', () => {
    const rules = ['count-clockwise', 'decinsky-sneznik-scored', 'final-scoring', 'flock-expanded', 'flock-scored',
      'game-start', 'mage-witch-joined', 'mage-witch-no-target', 'meteorite', 'obelisk-scored', 'trap', 'windmill-scored', 'wolf']
    expect(rules.filter(r => typeof get('game.cause.rule.' + r) !== 'string')).toEqual([])
  })

  it('falls back to the raw rule name for one not translated yet, and is empty without a cause', () => {
    expect(causeTitle({ type: 'rule', name: 'something-new' }, vm)).toBe('Caused by: something-new')
    expect(causeTitle(null, vm)).toBe('')
  })
})

describe('placement panel titles', () => {
  it('has an English title for every kind', () => {
    for (const k of ['moved', 'placed', 'placed-on-letter', 'removed']) {
      expect(typeof get('game.placement.title.' + k), k).toBe('string')
    }
    expect(vm.$t('game.placement.title.placed-on-letter', { figure: 'Courier' })).toBe('Courier placed on the Letter')
  })
})

describe('a regular (player-chosen) deployment', () => {
  it('has its own wording, not a cause', () => {
    expect(vm.$t('game.placement.deployed-by', { player: 'Betty' })).toBe('Deployed by Betty')
    expect(vm.$t('game.placement.moved-by', { player: 'John' })).toBe('Moved by John')
    expect(get('game.cause.from-supply')).toBeUndefined()
  })
})

describe('placed tile and castle wording', () => {
  it('exists in English', () => {
    expect(vm.$t('game.placement.placed-by', { player: 'Betty' })).toBe('Placed by Betty')
    expect(vm.$t('game.placement.converted-by', { player: 'John' })).toBe('Converted by John')
    expect(get('game.placement.title.tile-placed')).toBe('Tile placed')
    expect(get('game.placement.title.castle-created')).toBe('Small city converted to a castle')
  })
})
