import { describe, it, expect } from 'vitest'

import { ITEM_LABEL_KEYS, scoringItemLabel } from './scoring-items'
import en from '@/locales/en.json'

const get = path => path.split('.').reduce((o, k) => (o ? o[k] : undefined), en)
// a minimal i18n stand-in over en.json
const vm = { $te: key => typeof get(key) === 'string', $t: key => get(key) }

describe('scoring item labels', () => {
  it('maps every item name to an existing en.json key', () => {
    const missing = Object.entries(ITEM_LABEL_KEYS).filter(([, key]) => typeof get(key) !== 'string')
    expect(missing).toEqual([])
  })

  it('covers every item name the engine emits', () => {
    // from the TS engine's `new ExprItem(...)` calls (dynamic suffixes listed separately below)
    const engineItems = [
      'tiles', 'pennants', 'cathedral', 'besieged', 'darmstadtium', 'mage', 'witch', 'cities', 'castles',
      'coc', 'pigs', 'pigHerds', 'fishhut', 'river-tiles', 'vineyards', 'inn', 'meeples', 'wells', 'yaga',
      'church', 'gold', 'king', 'robber', 'king+robber', 'little-buildings', 'circus', 'acrobats',
      'wind-rose', 'shrine-challenge', 'monasteries', 'roads', 'fairy', 'black-fairy',
      'tiles.N', 'tiles.S', 'tiles.W', 'tiles.E',
      'little-buildings.LB_SHED', 'little-buildings.LB_HOUSE', 'little-buildings.LB_TOWER',
      'sheep.SHEEP_1X', 'sheep.SHEEP_4X', 'sheep.WOLF',
      'trade-goods.WINE', 'trade-goods.CLOTH', 'trade-goods.GRAIN',
      'flowers.FLOWERS_BLUE', 'marketplace.0', 'marketplace.3'
    ]
    const raw = engineItems.filter(name => scoringItemLabel(name, vm) === name)
    expect(raw).toEqual([])
  })

  it('translates the common ones', () => {
    expect(scoringItemLabel('pennants', vm)).toBe('Coat of Arms')
    expect(scoringItemLabel('tiles', vm)).toBe('Tiles')
    expect(scoringItemLabel('meeples', vm)).toBe('Meeples')
  })

  it('handles the prefixed names', () => {
    expect(scoringItemLabel('marketplace.2', vm)).toBe('Marketplace')
    expect(scoringItemLabel('sheep.SHEEP_3X', vm)).toBe('Sheep ×3')
    expect(scoringItemLabel('sheep.WOLF', vm)).toBe('Wolf')
    expect(scoringItemLabel('flowers.FLOWERS_WHITE', vm)).toBe('Flowers')
  })

  it('falls back to the raw name for something unmapped', () => {
    expect(scoringItemLabel('something-new', vm)).toBe('something-new')
    expect(scoringItemLabel('', vm)).toBe('')
  })
})
