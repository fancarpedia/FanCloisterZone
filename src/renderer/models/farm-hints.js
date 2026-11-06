// Which fields the farm-hints overlay colours, and in whose colour.
//
// Kept out of FarmHintsLayer.vue so it can be unit-tested: vitest has no .vue support here.
//
// The subtlety is the Barn. The engine derives a feature's `owners` from FOLLOWER power only
// (ScoreableTileFeature.getOwners), and a Barn is not a Follower — so a field holding a barn
// reports `owners: []`. Placing a barn also scores and returns every farmer on that field, so
// the barn is usually all that is left on it. Reading `owners` alone therefore drops exactly
// the fields a barn has claimed.

const placeKey = (x, y, location) => `${x},${y},${location}`

/**
 * Players holding a Barn, keyed by the place it sits on ("x,y,location").
 * `deployedMeeples` entries look like { type, player, position: [x, y], location }.
 */
export function barnOwnersByPlace (deployedMeeples) {
  const res = {}
  for (const m of deployedMeeples || []) {
    if (!m || m.type !== 'Barn') continue
    const [x, y] = m.position || []
    const key = placeKey(x, y, m.location)
    if (!res[key]) res[key] = []
    if (!res[key].includes(m.player)) res[key].push(m.player)
  }
  return res
}

/** Players with a Barn on any of this field's places. */
export function barnOwnersOf (field, barns) {
  const res = []
  for (const place of field.places || []) {
    const [x, y, location] = place
    for (const player of (barns || {})[placeKey(x, y, location)] || []) {
      if (!res.includes(player)) res.push(player)
    }
  }
  return res
}

/**
 * Who stands to score this field: the follower owners the engine reported, plus any barn owners.
 * A union rather than a fallback, so a field that somehow holds both is shown as contested.
 */
export function effectiveOwnersOf (field, barns) {
  const res = [...(field.owners || [])]
  for (const player of barnOwnersOf(field, barns)) {
    if (!res.includes(player)) res.push(player)
  }
  return res
}

/** True when the overlay should colour this feature at all. */
export function isHintedField (feature, barns) {
  if (feature.type !== 'Field') return false
  if (effectiveOwnersOf(feature, barns).length) return true
  // unclaimed: show only fields big enough to be worth hinting, never tiny slivers
  return !!feature.cities && (feature.places || []).length > 1
}
