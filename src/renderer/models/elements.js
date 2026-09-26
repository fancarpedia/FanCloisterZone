export class GameElement {
  /*
    tile sets:
      off - feature is disabled (missing required tiles)
      true / false - boolean feature
      int - can be added multiple tiles (meeples/GameElement sets)
  */

  constructor (id, title, configType, options = {}) {
    this.id = id
    this.title = title
    this.configType = configType
    Object.assign(this, options)
    GameElement.__all[id] = this
  }

  static all () {
    return Object.values(GameElement.__all)
  }

  static get (id) {
    return GameElement.__all[id]
  }
}

GameElement.__all = {}

export function isConfigValueEnabled (config) {
  return config !== false && config !== 0
}

// Meeples
// `keepBuildingMeeple` marks the figures that satisfy the Keep Building (coop variant)
// occupy-a-new-feature obligation — the engine's Follower subclasses. Their setup boxes show
// a badge while the variant is selected (see GameElementBox); Specials (builder, pig, barn,
// shepherd, …) never carry it.
export const SMALL_FOLLOWER = GameElement.SMALL_FOLLOWER = new GameElement('small-follower', 'Small Follower', Number, { default: 7, keepBuildingMeeple: true })
export const ABBOT = GameElement.ABBOT = new GameElement('abbot', 'Abbot', Number, { default: 0, keepBuildingMeeple: true, popularComponent: true })
export const PHANTOM = GameElement.PHANTOM = new GameElement('phantom', 'Phantom', Number, { default: 0, keepBuildingMeeple: true, popularComponent: true })
export const BIG_FOLLOWER = GameElement.BIG_FOLLOWER = new GameElement('big-follower', 'Big Follower', Number, { default: 0, keepBuildingMeeple: true })
// Mini Meeple (fan expansion): power 0.5, awarded during play for placing a regular tile into
// a hole. The value is the per-game CAP per player, not a starting supply — players begin with
// none and MiniMeepleCapability creates each figure as it is awarded.
// `default: 0` keeps it OFF unless the host picks it (a truthy default would force it into
// every game — see getDefaultElements in plugins/tiles.js). The count it jumps to when
// activated is the box's :default-value in FiguresTab.
export const MINI_FOLLOWER = GameElement.MINI_FOLLOWER = new GameElement('mini-follower', 'Mini Meeple', Number, { default: 0, keepBuildingMeeple: true })
export const BUILDER = GameElement.BUILDER = new GameElement('builder', 'Builder', Number, { default: 0 })
export const PIG = GameElement.PIG = new GameElement('pig', 'Pig', Number, { default: 0 })
export const BARN = GameElement.BARN = new GameElement('barn', 'Barn', Number, { default: 0 })
export const WAGON = GameElement.WAGON = new GameElement('wagon', 'Wagon', Number, { default: 0, keepBuildingMeeple: true })
export const MAYOR = GameElement.MAYOR = new GameElement('mayor', 'Mayor', Number, { default: 0, keepBuildingMeeple: true })
export const SHEPHERD = GameElement.SHEPHERD = new GameElement('shepherd', 'Shepherd', Number, { default: 0 })
export const RINGMASTER = GameElement.RINGMASTER = new GameElement('ringmaster', 'Ringmaster', Number, { default: 0, keepBuildingMeeple: true })

// Fan figures
export const OBELISK = GameElement.OBELISK = new GameElement('obelisk', 'Obelisk', Number, { default: 0, popularComponent: true })
export const WINDMILL = GameElement.WINDMILL = new GameElement('windmill', 'Windmill', Number, { default: 0 })
export const DECINSKY_SNEZNIK = GameElement.DECINSKY_SNEZNIK = new GameElement('decinsky-sneznik', 'Decinsky Sneznik', Number, { default: 0 })

// Neutral
export const DRAGON = GameElement.DRAGON = new GameElement('dragon', 'Dragon', Number, { selector: 'dragon' })
export const FAIRY = GameElement.FAIRY = new GameElement('fairy', 'Fairy', Number, { default: 0 })
// $t('game.feature.black-fairy') — fan expansion: a Fairy that scores NEGATIVE points
export const BLACK_FAIRY = GameElement.BLACK_FAIRY = new GameElement('black-fairy', 'Black Fairy', Number, { default: 0 })
export const COUNT = GameElement.COUNT = new GameElement('count', 'Count', Number, { selector: 'quarter' })
export const MAGE = GameElement.MAGE = new GameElement('mage', 'Mage', Number, { selector: 'mage' })
export const WITCH = GameElement.WITCH = new GameElement('witch', 'Witch', Number, { selector: 'mage' }) // trigger on tile is simply called mage
export const BIG_TOP = GameElement.BIG_TOP = new GameElement('big-top', 'Big Top', Number, { selector: 'circus' })

// Player Tokens
export const TOWER = GameElement.TOWER = new GameElement('tower', 'Tower pieces', Number, { selector: 'tower', notOnWeb: true })
export const ABBEY = GameElement.ABBEY = new GameElement('abbey', 'Abbey tile', Number, { default: 0, notOnWeb: true })
export const BRIDGE = GameElement.BRIDGE = new GameElement('bridge', 'Bridges', Number, { default: 0 })
export const CASTLE = GameElement.CASTLE = new GameElement('castle', 'Castles', Number, { default: 0 })
export const TUNNEL = GameElement.TUNNEL = new GameElement('tunnel', 'Tunnel tokens', Number, { notOnWeb: true })
export const FERRY = GameElement.FERRY = new GameElement('ferry', 'Ferries', Number, { selector: 'ferry', notOnWeb: true })
export const LITTLE_BUILDINGS = GameElement.LITTLE_BUILDINGS = new GameElement('little-buildings', 'Little Buildings', Number, { default: 0, popularComponent: true })

// Variants
// Pre-draw: private hand of up to N regular tiles (server-authoritative, online only).
// See PREDRAW_RULES.md / PREDRAW_DESIGN.md in the engine repo.
export const PRE_DRAW = GameElement.PRE_DRAW = new GameElement('pre-draw', 'Pre-draw hand', Number, { default: 0 })

// Keep Building: cooperative variant. Every turn the player must enlarge an occupied
// completable feature or occupy a new one — otherwise the game ends and ALL players lose.
// If nobody fails before the pack runs out, everyone wins with a combined team score.
export const KEEP_BUILDING = GameElement.KEEP_BUILDING = new GameElement('keep-building', 'Keep Building', Boolean, { default: false })

// Pre-draw needs an ordered tile pack + simple round-robin turns, so it is mutually exclusive with
// expansions that change tile-draw order (River/Fishermen, Dragon, Crop Circles), grant extra
// turns/placements (Wagon, Builder, Castle, Shepherd, Escape), or draw extra tiles (Bazaar, Count).
// Keep Building (coop) is also excluded — its enlarge-or-occupy turn model doesn't fit pre-draw.
// Enforced in store/gameSetup.js and surfaced in the setup UI. Keep in sync with the PHP server's
// predrawAllowed().
export const PRE_DRAW_INCOMPATIBLE = [
  // Bazaar is NOT here — it's allowed with pre-draw (it just reserves one pre-draw slot → auto-draw N-1).
  'builder', 'dragon', 'wagon', 'castle', 'shepherd', 'river', 'fishermen', 'escape', 'count', 'corn-circle', 'keep-building'
]

// Rewards
export const TRADERS = GameElement.TRADERS = new GameElement('traders', 'Trade goods', Boolean, { selector: 'city[resource]' })
export const KING = GameElement.KING = new GameElement('king', 'King', Boolean, { default: false })
export const ROBBER = GameElement.ROBBER = new GameElement('robber', 'Robber', Boolean, { default: false })
export const GOLD = GameElement.GOLD = new GameElement('gold', 'Gold pieces', Boolean, { selector: 'goldmine', notOnWeb: true })

// Game mechanics

export const FARMERS = GameElement.FARMERS = new GameElement('farmers', 'Farmers', Boolean, { default: true })
export const GARDEN = GameElement.GARDEN = new GameElement('garden', 'Gardens', Boolean, {
  default: false // switched by abbot change
})
export const CATHEDRAL = GameElement.CATHEDRAL = new GameElement('cathedral', 'Cathedrals', Boolean, {
  selector: 'city[cathedral]'
})
export const INN = GameElement.INN = new GameElement('inn', 'Inns', Boolean, {
  selector: 'road[inn]'
})
export const PRINCESS = GameElement.PRINCESS = new GameElement('princess', 'Princess', Boolean, {
  selector: 'city[princess]', notOnWeb: true
})
export const PORTAL = GameElement.PORTAL = new GameElement('portal', 'Magic portals', Boolean, {
  selector: 'portal', notOnWeb: true
})
export const PIG_HERD = GameElement.PIG_HERD = new GameElement('pig-herd', 'Pig Herds', Boolean, {
  selector: 'field[pig-herd]'
})
export const BAZAAR = GameElement.BAZAAR = new GameElement('bazaar', 'Bazaars', Boolean, {
  selector: 'bazaar', notOnWeb: true
})
export const HILL = GameElement.HILL = new GameElement('hill', 'Hills', Boolean, {
  selector: 'hill', notOnWeb: true
})
export const VINEYARD = GameElement.VINEYARD = new GameElement('vineyard', 'Vineyards', Boolean, {
  selector: 'vineyard', notOnWeb: true
})
export const SHRINE = GameElement.SHRINE = new GameElement('shrine', 'Monastery/Shrine challenges', Boolean, {
  selector: 'monastery[shrine]', notOnWeb: true
})
export const FESTIVAL = GameElement.FESTIVAL = new GameElement('festival', 'Festival', Boolean, {
  selector: 'festival'
})
export const SIEGE = GameElement.SIEGE = new GameElement('siege', 'Besieged cities', Boolean, {
  selector: 'city[besieged]', notOnWeb: true
})
export const ESCAPE = GameElement.ESCAPE = new GameElement('escape', 'Escaping a besieged city', Boolean, {
  selector: 'city[besieged]', notOnWeb: true
})
export const ACROBATS = GameElement.ACROBATS = new GameElement('acrobats', 'Acrobats', Boolean, {
  selector: 'acrobats'
})
export const FAMILIES = GameElement.FAMILIES = new GameElement('families', 'Families', Boolean, {
  selector: 'city[family]', notOnWeb: true
})
export const ROBBERS_SON = GameElement.ROBBERS_SON = new GameElement('robbers-son', 'Robber\'s son', Boolean, {
  selector: 'road[robbers-son]', notOnWeb: true
})
export const WELL = GameElement.WELL = new GameElement('well', 'Well', Boolean, {
  selector: 'road[wells]'
})

export const DONKEY = GameElement.DONKEY = new GameElement('donkey', 'Donkey', Number, { default: false })

export const FLOWERS = GameElement.FLOWERS = new GameElement('flowers', 'Flowers', Boolean, {
  selector: '*[flowers]', notOnWeb: true
})

export const MARKETPLACE = GameElement.MARKETPLACE = new GameElement('marketplace', 'Marketplace', Boolean, {
  selector: 'marketplace', notOnWeb: true
})

export const METEORITE = GameElement.METEORITE = new GameElement('meteorite', 'Meteorite', Boolean, {
  selector: 'crater', notOnWeb: true
})

export const FISHERMEN = GameElement.FISHERMEN = new GameElement('fishermen', 'Fishermen', Boolean, {
  selector: 'river', notOnWeb: true
})

export const BLACK_TOWER = GameElement.BLACK_TOWER = new GameElement('black-tower', 'Black & White Tower pieces', Number, {
  selector: 'tower',
  default: 0,
  popularComponent: true,
  notOnWeb: true
})

export const FISHHUT = GameElement.FISHHUT = new GameElement('fishhut', 'Fish Hut', Boolean, {
  selector: 'fishhut', notOnWeb: true
})

export const COURIER = GameElement.COURIER = new GameElement('courier', 'Courier', Number, {
  selector: 'courier-letter'
})

// Single source of truth for each element's setup/stats icon. One of:
//   { meeple: '<sprite>' } — sprite in assets/meeples.svg
//   { token:  '<sprite>' } — sprite in assets/tokens.svg
//   { neutral:'<figure>', w?: <px> } — <NeutralFigure>; w only for the wide dragon
//   { fig: '<file>.png', w?: <px>, h?: <px> } — image in assets/figures/
//   { tile: '<tileId>' } — <StandaloneTileImage>
//   { feature: '<C1|C2>/<file>' } — image in assets/features/ (tile-feature artwork)
// This table owns WHICH image an element uses. Each consumer owns HOW BIG it draws it, since
// they legitimately differ (the setup boxes are 55px, the game-list overview tiles are 70px) —
// the w/h here are the <GameElementIcon> defaults.
// Consumers: <GameElementIcon> (FiguresTab setup, FinalStats, the "most popular standalone
// elements" list) and <OverviewElementTile> (the setup summary in the server game list).
// A missing entry is how the Mini Meeple once rendered its "+2" badge with no figure at all —
// add new elements here, never to a consumer's own list.
/* eslint-disable quote-props */
export const ELEMENT_ICONS = {
  // followers / special meeples
  'small-follower': { meeple: 'small-follower' },
  'abbot': { meeple: 'abbot' },
  'phantom': { meeple: 'phantom' },
  'big-follower': { meeple: 'big-follower' },
  'mini-follower': { meeple: 'mini-follower' },
  'builder': { meeple: 'builder' },
  'pig': { meeple: 'pig' },
  'mayor': { meeple: 'mayor' },
  'wagon': { meeple: 'wagon' },
  'barn': { meeple: 'barn' },
  'shepherd': { meeple: 'shepherd' },
  'ringmaster': { meeple: 'ringmaster' },
  'obelisk': { meeple: 'obelisk' },
  'windmill': { meeple: 'windmill' },
  'decinsky-sneznik': { meeple: 'decinsky-sneznik' },
  // neutral figures
  'fairy': { neutral: 'fairy' },
  'black-fairy': { neutral: 'black-fairy' },
  'dragon': { neutral: 'dragon', w: 110 },
  'count': { neutral: 'count' },
  'mage': { neutral: 'mage' },
  'witch': { neutral: 'witch' },
  'big-top': { neutral: 'big-top' },
  'donkey': { neutral: 'donkey' },
  'courier': { neutral: 'courier' },
  // player tokens
  'tower': { fig: 'tower.png' },
  'black-tower': { fig: 'black_and_white_tower.png' },
  'abbey': { tile: 'AM/A' },
  'bridge': { fig: 'bridge-alt.png' },
  'castle': { fig: 'castle.png', w: 66 },
  'tunnel': { token: 'tunnel' },
  'ferry': { fig: 'ferry.png', h: 30 },
  'little-buildings': { fig: 'lb.png' },
  // rewards
  'traders': { fig: 'trade.png', h: 45 },
  'king': { fig: 'king.png' },
  'robber': { fig: 'robber.png' },
  'gold': { fig: 'gold.png', h: 40 },
  // tile features — artwork in assets/features/<edition>/
  'garden': { feature: 'C1/garden.png', w: 80, h: 55 },
  'inn': { feature: 'C1/inn.png', w: 55, h: 55 },
  'cathedral': { feature: 'C1/cathedral.png', w: 55, h: 55 },
  'princess': { feature: 'C1/princess.png', h: 55 },
  'portal': { feature: 'C1/magic_portal.png', h: 55 },
  'pig-herd': { feature: 'C1/pig_herd.jpg', h: 55 },
  'vineyard': { feature: 'C1/vineyard.png', h: 55 },
  'bazaar': { feature: 'C1/bazaar.png', h: 45 },
  'hill': { feature: 'C1/hill.png', h: 55 },
  'shrine': { feature: 'C1/shrine.jpg', h: 55 },
  'festival': { feature: 'C1/festival.png', h: 55 },
  'escape': { feature: 'C1/escape.png', h: 55 },
  'robbers-son': { feature: 'C1/robbers-son.png', h: 55 },
  'well': { feature: 'C2/well.png', h: 55 },
  'marketplace': { feature: 'C1/marketplace.png', h: 55 },
  'meteorite': { feature: 'C1/crater.png', h: 55 },
  'fishermen': { feature: 'C1/fishermen.png', h: 55 },
  'fishhut': { feature: 'C1/fishhut.png', h: 55 }
}
/* eslint-enable quote-props */

export function getElementIcon (id) {
  return ELEMENT_ICONS[id] || null
}
