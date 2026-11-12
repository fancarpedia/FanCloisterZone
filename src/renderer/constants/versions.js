// The oldest save this app will open: anything written by an EARLIER app version is refused
// (game.js compares with semver `<`). Raised for the same reason as the protocol below - a save
// can now carry ROTATE_TILE in its replay, which an older app cannot apply.
//
// It tracks the app's own version from package.json, prerelease tag included, because semver puts
// 7.1.0-alpha.1 BEFORE 7.1.0: a bare '7.1.0' here would make this build refuse its own saves.
export const SAVED_GAME_COMPATIBILITY = '7.1.0-alpha.1'

// The network protocol version. It is BOTH the current and the minimum accepted version: the
// handshake compares it for exact equality (localServer.js), so a client only talks to a peer
// announcing the very same number and there is no older protocol to fall back to.
//
// 7.1.0 is the first version carrying ROTATE_TILE and the engine's `tileRotation` state - an
// older peer neither sends nor understands either, so 6.2.0 clients are intentionally refused.
export const NETWORK_PROTOCOL_COMPATIBILITY = '7.1.0'

// The lowest protocol this app can play with, announced in HELLO next to protocolVersion. The
// server passes both on in the online players list, where the client marks incompatible players
// (utils/protocol-compat.js). Equal to the current protocol while nothing older is supported.
export const NETWORK_PROTOCOL_MINIMUM = '7.1.0'
