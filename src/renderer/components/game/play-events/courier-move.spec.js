import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Hovering the courier's move bullet shows where it came from (a pulsing ghost), the features its
// move scored, and their meeples that have since left the board. Its scoring sits in separate
// score rows, so each row carries the whole turn's events (turnEvents) and the move bullet reads
// them. No component harness here: pinned at source level, like castle-score-source.spec.js.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const read = file => fs.readFileSync(path.join(DIR, file), 'utf8').split(CR).join('')
const moved = read('NeutralMovedEvent.vue')
const playEvent = read('PlayEvent.vue')
const row = read('EventsRow.vue')
const playEvents = read('../PlayEvents.vue')

describe('courier move hover', () => {
  it('always takes the courier path, scored or not', () => {
    expect(moved).toMatch(/if \(this\.figure === 'courier'\) \{\s*this\.showCourierMove\(\)\s*return/)
  })

  it('opens only single spots — origin, destination and the scored meeples — not whole features', () => {
    expect(moved).toContain('const points = [from, to, ...scored].filter(p => p && p.position && p.feature && p.location)')
    expect(moved).toContain("emphasis: withCause({ type: 'points', points, frame: center || null }, this.ev.cause)")
    expect(moved).not.toContain("emphasis: { type: 'feature'")
  })

  it('frames the 3x3 range around the destination, like the wagon', () => {
    expect(moved).toContain('Math.abs(m.position[0] - center[0]) <= 1 && Math.abs(m.position[1] - center[1]) <= 1')
    const layer = read('../layers/EmphasizeLayer.vue')
    expect(layer).toContain("v-else-if=\"emphasis.type === 'points'\"")
    expect(layer).toContain('const lo = -BASE_SIZE - 20')
    expect(layer).toContain('const hi = 2 * BASE_SIZE + 20')
  })

  it('ghosts the courier at its ORIGINAL position (the event "from")', () => {
    expect(moved).toContain('const from = this.ev.from && (this.ev.from.featurePointer || this.ev.from)')
    expect(moved).toContain("const ghosts = courierGhosts(from, to, p => !this.isFairyRemoved('courier', p))")
    // not gated on the move having scored anything
    const body = moved.slice(moved.indexOf('showCourierMove () {'))
    expect(body.slice(0, body.indexOf('courierScoring () {'))).not.toContain('return false')
  })

  it('collects the courier.* scoring that follows the move, up to the next courier move', () => {
    expect(moved).toContain("if ((p.name || '').startsWith('courier.')) out.push(p)")
    expect(moved).toContain("if (e.type === 'neutral-moved' && (e.figure || '').startsWith('courier')) break")
  })

  it('pulses only the scored meeples that left the board', () => {
    expect(moved).toContain('const removed = [...scored, ...(trigger ? [trigger] : [])].filter(m => m.type && this.isMeepleRemoved(m))')
  })

  it('gets the whole turn, not just its own row', () => {
    expect(playEvents).toContain('row = { events: [], height: isScore ? 27 : 41, turnEvents }')
    expect(playEvents).toContain('turnEvents.push(ev)')
    expect(row).toContain(':siblings="row.turnEvents || row.events"')
    expect(playEvent).toContain('this.component === NeutralMovedEvent || this.component === PointsEvent')
  })
})

describe('courier points show where the courier stood', () => {
  const points = read('PointsEvent.vue')
  const branch = points.slice(points.indexOf("if (name.startsWith('courier.')) {"))
  const body = branch.slice(0, branch.indexOf('return'))

  it('ghost the courier at the destination of the move before them, beside its meeple', () => {
    expect(points).toContain('const to = e.to && (e.to.featurePointer || e.to)')
    expect(body).toContain("props: { ghosts: [{ figure: 'courier', ptr: at, nextToMeeple: at.feature !== 'CourierLetter' }] }")
  })

  it('do not show where it came from', () => {
    expect(body).not.toContain('e.from')
  })

  it('circle the courier spot in the dimming, as on the move bullet', () => {
    expect(body).toContain('const extraPoints = at ? [at] : []')
    expect(body).toContain('this.showTiles(ptr.positions, extraPoints)')
    expect(body).toContain('this.showFeature(feature, extraPoints)')
    expect(read('../layers/EmphasizeLayer.vue')).toContain('v-for="(p, idx) in extraPointTransforms"')
  })

  it('get the turn events', () => {
    expect(playEvent).toContain('this.component === NeutralMovedEvent || this.component === PointsEvent ? { siblings: this.siblings } : {}')
  })
})

describe('courier points of a range feature', () => {
  const points = read('PointsEvent.vue')
  it('light the tiles that earned them', () => {
    const branch = points.slice(points.indexOf("if (name.startsWith('courier.')) {"))
    expect(branch.slice(0, 800)).toContain('this.showTiles(ptr.positions, extraPoints)')
  })
})

describe('placement causes in the history', () => {
  const files = ['NeutralMovedEvent.vue', 'MeepleDeployedEvent.vue', 'MeepleReturnedEvent.vue', 'TokenPlacedEvent.vue', 'TokenRemovedEvent.vue']
  for (const file of files) {
    it(file + ' shows the cause as a tooltip and opens it on the board', () => {
      const src = read(file)
      expect(src).toContain(':title="causeTitle"')
      expect(src).toContain('return causeTitle(this.ev.cause, this) || null')
      expect(src).toContain('this.ev.cause)')
      expect(src).toContain('withCause(')
    })
  }

  it('the dimming can open whole extra tiles', () => {
    expect(read('../layers/EmphasizeLayer.vue')).toContain('v-for="(pos, idx) in emphasis.extraTiles || []"')
  })
})

describe('the action panel tells what a history event did and why (PlacementPanel)', () => {
  const panel = read('../PlacementPanel.vue')
  const actionPanel = read('../ActionPanel.vue')

  it('is shown in the action panel while hovering, like the dice-roll / returned-meeple panels', () => {
    expect(actionPanel).toContain('<PlacementPanel')
    expect(actionPanel).toContain('v-else-if="placementPanel"')
    expect(actionPanel).toContain('!returnedTokenPanel && !diceRollPanel && !placementPanel"')
  })

  it('is set by the neutral-move bullet for every move, and cleared on leave', () => {
    expect(moved).toContain("this.$store.commit('board/placementPanel', {")
    expect(moved).toContain("kind: !to ? 'removed' : (!from ? 'placed' : 'moved'),")
    expect(moved).toContain("this.$store.commit('board/placementPanel', null)")
  })

  it('is set by meeple / token bullets that carry a cause', () => {
    for (const file of ['MeepleDeployedEvent.vue', 'MeepleReturnedEvent.vue', 'TokenPlacedEvent.vue', 'TokenRemovedEvent.vue']) {
      const src = read(file)
      expect(src, file).toContain("this.$store.commit('board/placementPanel', ")
      expect(src, file).toContain("this.$store.commit('board/placementPanel', null)")
    }
  })

  it('titles the courier on the letter specially and draws the cause beside the figure', () => {
    expect(panel).toContain("if (to && to.feature === 'CourierLetter') {")
    expect(panel).toContain("this.$t('game.placement.title.placed-on-letter', { figure: this.subjectName })")
    expect(panel).toContain(':tile-id="causeVisual.tile.id"')
    expect(panel).toContain('<Meeple v-else-if="causeVisual.meeple" :type="causeVisual.meeple" />')
  })
})

describe('cause panel order', () => {
  it('shows the cause first, then an arrow to what it placed', () => {
    const panel = read('../PlacementPanel.vue')
    const cause = panel.indexOf('<div class="cause"')
    const arrow = panel.indexOf('fas fa-arrow-right')
    const subject = panel.indexOf('class="subject')
    expect(cause).toBeGreaterThan(-1)
    expect(cause).toBeLessThan(arrow)
    expect(arrow).toBeLessThan(subject)
    expect(panel).not.toContain('fas fa-arrow-left')
  })
})

describe('cause panel: a figure that walked to a deployed meeple', () => {
  it('is drawn standing next to that meeple on the right of the arrow', () => {
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain('<div v-if="besideMeeple" class="subject beside-meeple">')
    expect(panel).toContain("if (!this.expr.figure || !c || c.type !== 'meeple-deployed' || !c.meeple) return null")
    expect(panel.indexOf('fas fa-arrow-right')).toBeLessThan(panel.indexOf('class="subject beside-meeple"'))
  })
})

describe('a regular deployment in the placement panel', () => {
  it('every meeple-deployed hover fills the panel; without a cause it is the player\'s own choice', () => {
    const src = read('MeepleDeployedEvent.vue')
    expect(src).toContain('byPlayer: !this.ev.cause')
    expect(src).not.toContain('if (this.ev.cause) {')
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain("(this.expr.kind === 'moved' ? 'game.placement.moved-by' : 'game.placement.deployed-by')")
    expect(panel).not.toContain('from-supply')
  })

  it('draws the courier as big as the meeple it stands beside', () => {
    expect(read('../PlacementPanel.vue')).toMatch(/svg\.neutral\.beside\s+width: 40px\s+height: 40px/)
  })
})

describe('player-chosen placements in the placement panel', () => {
  it('a placed tile: the tile, placed by the turn player', () => {
    const src = read('TilePlacedEvent.vue')
    expect(src).toContain("titleKey: 'game.placement.title.tile-placed'")
    expect(src).toContain("byKey: 'game.placement.placed-by'")
    expect(src).toContain('player: { type: Number, default: null }')
    expect(src).toContain("this.$store.commit('board/placementPanel', null)")
  })

  it('a castle: the small city converted with a castle token, by the turn player', () => {
    const src = read('CastleCreatedEvent.vue')
    expect(src).toContain("titleKey: 'game.placement.title.castle-created'")
    expect(src).toContain("byKey: 'game.placement.converted-by'")
    expect(src).toContain("this.$store.commit('board/placementPanel', null)")
  })

  it('the panel draws a tile subject and honours the title / by-player overrides', () => {
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain(':tile-id="expr.tile.id"')
    expect(panel).toContain('if (this.expr.titleKey) return this.$t(this.expr.titleKey)')
    expect(panel).toContain('const key = this.expr.byKey ||')
  })
})

describe('placement panel token colour', () => {
  it('uses the same theme text colour as the history bullets (castle not black on dark)', () => {
    const rule = '.token-image:not(.tunnel):not(.token-BRIDGE)\n  +theme using ($theme)\n    fill: map-get($theme, \'text-color\')'
    expect(read('../PlacementPanel.vue')).toContain(rule)
  })
})

describe('a meeple removed with the Princess (or another return source)', () => {
  const returned = read('MeepleReturnedEvent.vue')
  const panel = read('../PlacementPanel.vue')

  it('fills the placement panel with the source, the meeple and the player who used it', () => {
    expect(returned).toContain('} else if (this.ev.source) {')
    expect(returned).toContain('actor: this.player,')
    expect(returned).toContain('source: this.ev.source')
    expect(panel).toContain("this.$t('game.placement.removed-with', { source: what, player: this.playerName })")
    expect(panel).toContain("PRINCESS: 'game.feature.princess',")
    expect(panel).toContain("PRINCESS: require('~/assets/features/C1/princess.png'),")
    expect(panel).toContain('<img v-else-if="causeVisual.image" :src="causeVisual.image" class="source-image">')
  })

  it('names the player who used it, not the meeple owner', () => {
    expect(panel).toContain('const idx = this.expr.actor !== undefined && this.expr.actor !== null ? this.expr.actor : this.expr.player')
  })

  it('draws the removed meeple back on the board at the spot it left', () => {
    expect(returned).toContain("layer: 'EventMeeplesLayer',")
    expect(returned).toContain("this.$store.dispatch('board/hideLayerDebounced', { layer: 'EventMeeplesLayer' })")
  })
})

describe('a token placed by the player (tower piece, bridge, little building, …)', () => {
  it('fills the placement panel with "Placed by <player>"', () => {
    const src = read('TokenPlacedEvent.vue')
    expect(src).toContain("byKey: 'game.placement.placed-by'")
    expect(src).toContain('player: this.player, byPlayer: true')
    expect(src).not.toContain('if (this.ev.cause) {\n        this.$store.commit')
  })

  it('names tower pieces, little buildings and tunnels by their game names', () => {
    const panel = read('../PlacementPanel.vue')
    expect(panel).toContain("TOWER_PIECE: 'game.element.tower',")
    expect(panel).toContain("LB_SHED: 'game.scoring.item-shed',")
    expect(panel).toContain("if (token && /^TUNNEL_/.test(token) && this.$te('game.element.tunnel'))")
  })
})

describe('every neutral figure move shows where it came from', () => {
  const body = moved.slice(moved.indexOf('    showMoveGhosts () {'), moved.indexOf('    // The meeple the fairy is associated with'))

  it('ghosts the old spot faded (from) and the new spot pulsing (to) once the figure moved on', () => {
    expect(body).toContain("role: 'from' })")
    expect(body).toContain('if (to && this.isFairyRemoved(this.figure, to)) {')
    expect(body).toContain("role: 'to' })")
    expect(body).toContain("const symbol = this.figure === 'bigtop' ? 'big-top' : this.figure")
  })

  it('is used for every non-courier move and for removals', () => {
    expect(moved).toContain('// removed from the board: show where it stood\n        this.showMoveGhosts()')
    expect(moved).toContain('      this.showMoveGhosts()\n\n      // For the fairy / black fairy')
  })
})
