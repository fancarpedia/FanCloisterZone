// Where a history event happened, for centring the board on it while the event is hovered.
//
// Takes the EmphasizeLayer `emphasis` the event shows and returns the middle of every tile it
// touches, in tile units ({ x, y }, a tile's own centre is position + 0.5), or null when it names
// no spot on the board. Several tiles (a feature, the dice's tiles, a castle) give the middle of
// their bounding box.

const positionOf = p => {
  if (!p) return null
  if (Array.isArray(p)) return p.length >= 2 ? p : null
  return Array.isArray(p.position) ? p.position : null
}

export const emphasisPositions = emphasis => {
  if (!emphasis) return []
  const out = []
  const add = p => {
    const pos = positionOf(p)
    if (pos) out.push(pos)
  }
  switch (emphasis.type) {
  case 'tile':
  case 'meeple':
    add(emphasis.position)
    break
  case 'tiles':
  case 'castle':
    (emphasis.positions || []).forEach(add)
    break
  case 'feature':
    (emphasis.places || []).forEach(place => add(place.tile))
    break
  case 'points':
    (emphasis.points || []).forEach(add)
    break
  }
  ;(emphasis.extraPoints || []).forEach(add)
  ;(emphasis.extraTiles || []).forEach(add)
  if (emphasis.frame) add(emphasis.frame)
  return out
}

export const emphasisCenter = emphasis => {
  const positions = emphasisPositions(emphasis)
  if (!positions.length) return null
  const xs = positions.map(p => p[0])
  const ys = positions.map(p => p[1])
  return {
    x: (Math.min(...xs) + Math.max(...xs) + 1) / 2,
    y: (Math.min(...ys) + Math.max(...ys) + 1) / 2
  }
}

/**
 * Pan offsets that put the board point `center` (tile units) at the screen point `target`, for the
 * board group transform `rotate(r Ox Oy) translate(Ox Oy) scale(z)`: a board point p lands at
 * O + R(r)·(z·p), so O = target − R(r)·(z·p).
 */
export const offsetsCentering = ({ center, target, zoom, rotate, baseSize }) => {
  const dx = center.x * baseSize * zoom
  const dy = center.y * baseSize * zoom
  const rad = (rotate || 0) * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    offsetX: target.x - (dx * cos - dy * sin),
    offsetY: target.y - (dx * sin + dy * cos)
  }
}
