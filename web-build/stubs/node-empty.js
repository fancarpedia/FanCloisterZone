// Browser stub for Node-only modules the renderer imports: child_process, net, fs, fs-extra,
// graceful-fs, megajs.
//
// IMPORTANT — `graceful-fs` must be aliased to this too, not just `fs-extra` above it. graceful-fs
// monkey-patches fs AT IMPORT TIME (`Object.setPrototypeOf(read, fs.read)`), so with a plain fs stub
// it throws "Object prototype may only be an Object or null" and kills the app BEFORE Vue mounts.
//
// Calls that would really need the filesystem throw loudly rather than degrading silently, so it is
// obvious which feature hit the wall. In this lobby-only build that means: local games (engine spawn)
// and the addon loader. Both are expected — see README.
const boom = (name) => () => {
  throw new Error('[web-build] Node-only API not available in browser: ' + name)
}

// net — the embedded local WebSocket server.
// (child_process is NOT stubbed here — it has its own stub that runs the engine in a Web Worker.)
export const createServer = boom('net.createServer')
export const connect = boom('net.connect')

// fs / fs-extra — the addon loader (scan user dir, read tile images, unpack downloads).
// Reads that are merely *probing* return benign empties so boot can continue.
export const existsSync = () => false
export const readdirSync = () => []
export const mkdirSync = () => {}
export const statSync = boom('fs.statSync')
export const readFileSync = boom('fs.readFileSync')
export const writeFileSync = boom('fs.writeFileSync')
export const createWriteStream = boom('fs.createWriteStream')
export const createReadStream = boom('fs.createReadStream')
export const constants = { R_OK: 4, W_OK: 2, F_OK: 0 }
export const promises = {
  // The app probes the engine at startup with `fs.promises.access(enginePath, R_OK)` before running
  // its --version. There is no filesystem, but the engine DOES exist (as a Web Worker), so resolve
  // — otherwise the app reports "Can't locate game engine" and refuses to start a game.
  access: () => Promise.resolve(),
  mkdir: () => Promise.resolve(),          // addon dirs: pretend success, nothing is written
  readdir: () => Promise.resolve([]),      // no addons on disk
  readFile: boom('fs.promises.readFile'),
  writeFile: boom('fs.promises.writeFile'),
  stat: boom('fs.promises.stat')
}

// megajs — addon downloads from Mega.
export class File {}
export class Storage {}

export default {
  createServer, connect,
  existsSync, readdirSync, mkdirSync, statSync, readFileSync, writeFileSync,
  createWriteStream, createReadStream, constants, promises,
  File, Storage
}
