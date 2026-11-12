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
    expect(moved).toContain("emphasis: { type: 'points', points, frame: center || null }")
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
    expect(moved).toContain('const removed = scored.filter(m => m.type && this.isMeepleRemoved(m))')
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
