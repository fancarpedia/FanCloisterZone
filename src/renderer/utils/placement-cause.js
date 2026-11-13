// The engine names what triggered a placement, move or return that no player chose directly
// (PlacementCause → `cause` on the meeple-deployed / meeple-returned / neutral-moved / token-placed
// / token-removed history events). These helpers turn it into something the board can show:
//   tile-placed     { position }                → open that whole tile in the dimming
//   meeple-deployed { pointer, meeple }         → open the meeple's spot (and pulse it if gone)
//   figure-moved    { figure, pointer }         → open where the figure went
//   rule            { name }                    → nothing on the board, a tooltip only

// a pointer of any shape → { position, feature, location } or a bare [x, y] position
const spotOf = pointer => {
  if (!pointer) return null
  if (Array.isArray(pointer)) return pointer
  const fp = pointer.featurePointer || pointer
  return fp && fp.position ? fp : null
}

// the extra openings a cause adds to an EmphasizeLayer emphasis
export const causeHighlight = cause => {
  const extraPoints = []
  const extraTiles = []
  if (!cause) return { extraPoints, extraTiles }
  if (cause.type === 'tile-placed' && cause.position) {
    extraTiles.push(cause.position)
  } else if (cause.type === 'meeple-deployed' || cause.type === 'figure-moved') {
    const spot = spotOf(cause.pointer)
    if (Array.isArray(spot)) extraTiles.push(spot)
    else if (spot && spot.location) extraPoints.push(spot)
    else if (spot) extraTiles.push(spot.position)
  }
  return { extraPoints, extraTiles }
}

// an emphasis with the cause's openings merged in (keeps any it already has)
export const withCause = (emphasis, cause) => {
  const { extraPoints, extraTiles } = causeHighlight(cause)
  if (!extraPoints.length && !extraTiles.length) return emphasis
  return {
    ...emphasis,
    extraPoints: [...(emphasis.extraPoints || []), ...extraPoints],
    extraTiles: [...(emphasis.extraTiles || []), ...extraTiles]
  }
}

// the deployed meeple a cause names, in EventMeeplesLayer shape (to pulse it once it has left)
export const causeMeeple = cause => {
  if (!cause || cause.type !== 'meeple-deployed' || !cause.meeple) return null
  const spot = spotOf(cause.pointer)
  if (!spot || Array.isArray(spot)) return null
  return {
    type: cause.meeple.type,
    player: cause.meeple.player,
    position: spot.position,
    feature: spot.feature,
    location: spot.location
  }
}

// a localized tooltip line, e.g. "Caused by: the placed tile"; '' without a cause
export const causeTitle = (cause, vm) => {
  if (!cause) return ''
  let what
  if (cause.type === 'rule') {
    const key = 'game.cause.rule.' + cause.name
    what = vm.$te(key) ? vm.$t(key) : cause.name
  } else {
    const key = 'game.cause.' + cause.type
    what = vm.$te(key) ? vm.$t(key) : cause.type
  }
  return vm.$t('game.cause.caused-by', { cause: what })
}
