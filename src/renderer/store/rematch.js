// Pure helpers behind the "Rematch" button (GameResultPanel.vue) and its online seat handoff
// (networking.js). Kept dependency-free (no Vue/Vuex/Electron) so they can be unit tested in
// isolation from the rest of the app.

// Rematch swaps the finished game's seating so a rematch always reverses starting order.
// The reversal MUST be deterministic: for an online rematch, the new seats are claimed by
// replaying this exact sequence via TAKE_SLOT (see claimableRematchSlots below), so a random
// result would make the "who plays first" outcome unreproducible and, if two clients raced,
// could hand a seat to whichever one answered the server first.
export function reverseSeatOrder (slots) {
  // Deep copy, and drop identifiers tied to the finished game — they must not leak into the
  // next one.
  const result = slots.map(s => {
    const copy = JSON.parse(JSON.stringify(s))
    if ('gameId' in copy) copy.gameId = null
    if ('sessionId' in copy) copy.sessionId = null
    return copy
  })

  const orderedPlayers = result.filter(s => s.order !== undefined)
  const reversedOrders = orderedPlayers.map(s => s.order).reverse()
  orderedPlayers.forEach((player, i) => {
    player.order = reversedOrders[i]
  })

  return result
}

// Online-hotseat rematch: the server assigns seating by TAKE_SLOT sequence, so the client
// replays `rematchSlots` (the reversed seating, queued by the Rematch button) in order against
// the freshly created game's slots. A seat is only claimed while it is still free — if another
// client (a stranger who saw the game appear in the public list) grabbed it first, `clientId`
// is already set and that seat is skipped instead of being taken over.
export function claimableRematchSlots (rematchSlots, gameSlots) {
  return rematchSlots.filter(rs => {
    const slot = gameSlots.find(s => s.number === rs.number)
    return slot && !slot.clientId
  })
}
