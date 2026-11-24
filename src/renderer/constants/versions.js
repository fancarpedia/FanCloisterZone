// The oldest save this app will open: anything written by an EARLIER app version is refused
// (game.js compares with semver `<`). Raised for the same reason as the protocol below - a save
// can now carry ROTATE_TILE in its replay, which an older app cannot apply.
//
// It tracks the app's own version from package.json, prerelease tag included, because semver puts
// 7.1.0-alpha.1 BEFORE 7.1.0: a bare '7.1.0' here would make this build refuse its own saves.
// 7.2.0: the engine plays differently (supply tiles / TileFromSupplyPhase, Kingdom Palace, pre-draw,
// Keep Building, rule fixes) — a 7.1 replay is no longer guaranteed to end in the same state.
// 7.3.0: Watchtowers became an opt-out element (`watchtower`) — a 7.2 save never sets it, so its
// replay would be played without Watchtowers on the 7.3 engine and end in a different state.
// (The network protocol stays 7.2.0.)
export const SAVED_GAME_COMPATIBILITY = '7.3.0-alpha.1'

// The network protocol version. It is BOTH the current and the minimum accepted version: the
// handshake compares it for exact equality (localServer.js), so a client only talks to a peer
// announcing the very same number and there is no older protocol to fall back to.
//
// 7.1.0 is the first version carrying ROTATE_TILE and the engine's `tileRotation` state - an
// older peer neither sends nor understands either, so 6.2.0 clients are intentionally refused.
// 7.2.0: every client runs its own engine on the same moves, and the 7.2 engine plays some of them
// differently (supply tiles, Kingdom Palace, pre-draw, Keep Building, rule fixes) — a 7.1 peer
// would drift out of sync mid-game, so it is refused.
export const NETWORK_PROTOCOL_COMPATIBILITY = '7.2.0'

// The lowest protocol this app can play with, announced in HELLO next to protocolVersion. The
// server passes both on in the online players list, where the client marks incompatible players
// (utils/protocol-compat.js). Equal to the current protocol while nothing older is supported.
export const NETWORK_PROTOCOL_MINIMUM = '7.2.0'
