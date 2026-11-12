// Localized labels for the item names the engine puts into scoring expressions
// (PointsExpression items: 'tiles', 'pennants', 'sheep.SHEEP_2X', 'marketplace.0', …).
// Used for the final-statistics breakdown rows and the scoring icon tooltips, which
// otherwise showed the raw engine name.

// exact item name -> locale key
export const ITEM_LABEL_KEYS = {
  'tiles': 'core-messages.tiles',
  'pennants': 'game.feature.coat-of-arms',
  'cathedral': 'game.feature.cathedral',
  'besieged': 'game.feature.siege',
  'inn': 'game.feature.inn',
  'wells': 'game.feature.wells',
  'marketplace': 'game.feature.marketplace',
  'meeples': 'game-setup.components.followers',
  'mage': 'game.element.mage',
  'witch': 'game.element.witch',
  'cities': 'game.feature.cities',
  'castles': 'game.feature.castles',
  'roads': 'game.feature.roads',
  'monasteries': 'game.feature.monasteries',
  'pigs': 'game.element.pig',
  'pigHerds': 'game.feature.pig-herd',
  'coc': 'game.element.count',
  'vineyards': 'game.feature.vineyard',
  'king': 'game.feature.king',
  'robber': 'game.feature.robber',
  'king+robber': 'game.feature.king-and-robber',
  'gold': 'game.feature.gold',
  'church': 'game.feature.church-bonus',
  'wind-rose': 'game.feature.wind-rose',
  'yaga': 'game.feature.yaga-hut',
  'fishhut': 'game.feature.fishhut',
  'shrine-challenge': 'game.feature.shrine-challenge',
  'acrobats': 'game.feature.acrobats',
  'circus': 'game.feature.big-top',
  'little-buildings': 'game.element.little-buildings',
  'fairy': 'game.feature.fairy',
  'black-fairy': 'game.feature.black-fairy',
  'river-tiles': 'game.scoring.item-river-tiles',
  'darmstadtium': 'game.scoring.item-darmstadtium',
  'tiles.N': 'game.scoring.item-tiles-north',
  'tiles.S': 'game.scoring.item-tiles-south',
  'tiles.W': 'game.scoring.item-tiles-west',
  'tiles.E': 'game.scoring.item-tiles-east',
  'little-buildings.LB_SHED': 'game.scoring.item-shed',
  'little-buildings.LB_HOUSE': 'game.scoring.item-house',
  'little-buildings.LB_TOWER': 'game.scoring.item-tower',
  'sheep.WOLF': 'game.scoring.item-wolf',
  'trade-goods.WINE': 'game.scoring.item-wine',
  'trade-goods.CLOTH': 'game.scoring.item-cloth',
  'trade-goods.GRAIN': 'game.scoring.item-grain',
  'flowers': 'game.feature.flowers'
}

// The label for one item name; `vm` is any component (for $t / $te). Falls back to the raw
// name only for something the engine adds later and nobody mapped yet.
export const scoringItemLabel = (name, vm) => {
  if (!name) return ''
  const key = ITEM_LABEL_KEYS[name]
  if (key && vm.$te(key)) return vm.$t(key)
  // one item per marketplace-adjoining road: marketplace.0, marketplace.1, …
  if (name.startsWith('marketplace.')) return vm.$t(ITEM_LABEL_KEYS.marketplace)
  // sheep tokens SHEEP_1X … SHEEP_4X: "Sheep ×2"
  const sheep = /^sheep\.SHEEP_(\d+)X$/.exec(name)
  if (sheep) return vm.$t('game.feature.sheep') + ' ×' + sheep[1]
  // flowers.FLOWERS_BLUE, …: the colour is shown by the icon
  if (name.startsWith('flowers.')) return vm.$t(ITEM_LABEL_KEYS.flowers)
  return name
}
