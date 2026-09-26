// Browser `fs` for FanCloisterZone.
//
// Two backing stores, mirroring how the desktop app works:
//
//   /resources/**  -> ships WITH the app (tile-definition XMLs, built-in jcz addon, ~300 KB).
//                     Served straight out of dist/vfs via fetch + a build-time manifest.
//                     Read-only, exactly like Electron's extraResources.
//
//   /userdata/**   -> addons the user DOWNLOADS (classic artwork, ~32 MB). Stored in IndexedDB so
//                     they persist across reloads — the browser equivalent of Electron's userData
//                     dir. Read AND write. (Not OPFS: it is absent in Firefox private windows and
//                     older browsers, with no fallback — see stubs/storage.js.)
//
// The app keeps using its normal virtual paths; this module decides where the bytes come from.
// It also provides just enough Node-stream shape (createReadStream/createWriteStream) for
// plugins/addons.js to download and unpack an addon without modification.
import * as opfs from './storage.js'

// dist/vfs/<VFS_VER> — the shipped /resources tree. The version segment (build.js injects
// window.__FCZ_VFS_VER__) cache-busts the fixed-name artwork/tile files across rebuilds.
const VFS_VER = (typeof window !== 'undefined' && window.__FCZ_VFS_VER__) || ''
const VFS_BASE = 'vfs' + (VFS_VER ? '/' + VFS_VER : '')

// Offline build: no Service Worker is shipped or registered (build.js sets this). Downloaded
// add-ons live only in IndexedDB and their images are served BY the SW, so without one they are
// unusable — treat /userdata as empty here and never wait for a controller that cannot arrive.
const NO_SW = (typeof window !== 'undefined' && !!window.__FCZ_NO_SW__)

const norm = opfs.norm
const isUser = opfs.isUserData

// Buffers of files written this session, keyed by path. sha256-file needs a SYNCHRONOUS read of the
// .jca it just downloaded, which async storage cannot do — so keep the bytes until it is unlinked.
const memory = new Map()
export const _memory = memory

const enoent = (p) => {
  const e = new Error('ENOENT: no such file or directory: ' + p)
  e.code = 'ENOENT'
  return e
}

// --- shipped /resources tree (manifest + fetch) -----------------------------------------------

let manifestPromise = null
const manifest = () => {
  if (!manifestPromise) {
    manifestPromise = fetch(new URL(VFS_BASE + '/manifest.json', document.baseURI).href)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return manifestPromise
}

const resourceUrl = (p) => new URL(VFS_BASE + norm(p), document.baseURI).href

// Gate every /userdata read on the Service Worker being in control.
//
// Downloaded addons live ONLY in IndexedDB — nothing under /vfs/userdata/** exists on the server.
// Their JSON is read here (directly from IndexedDB, no SW involved), but their IMAGES are plain
// URLs that the SW must intercept. The artwork loader reads the JSON and *then* hands out those
// image URLs, so if the worker has not taken control by that point every image 404s — and a failed
// <image> never retries. The result is an app that looks fine with broken tiles, which is exactly
// what happened on Chrome/Android, where SW startup is slower than on desktop.
//
// Awaiting readiness here (rather than in the artwork loader) keeps the fix in the stub layer and
// guarantees the ordering for any caller. Bounded, so a browser without SW support still boots
// — it will render broken images, but it will not hang.
// NB: `navigator.serviceWorker.ready` is NOT enough — it resolves once a worker is ACTIVATED, which
// is not the same as it CONTROLLING this page. A page loaded before any worker existed stays
// uncontrolled for its whole lifetime; `ready` resolves happily and the images still 404. So wait on
// `controller` (build.js reloads once on a first visit to get one).
let swReadyPromise = null
const swReady = () => {
  if (!swReadyPromise) {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (NO_SW) {
      // Offline build: no worker is registered, so `controllerchange` can never fire and this would
      // burn the full 15s timeout on every load. Resolve immediately instead.
      swReadyPromise = Promise.resolve(false)
    } else if (!nav || !nav.serviceWorker) {
      swReadyPromise = Promise.resolve(false)
    } else if (nav.serviceWorker.controller) {
      swReadyPromise = Promise.resolve(true)
    } else {
      swReadyPromise = Promise.race([
        new Promise((r) => nav.serviceWorker.addEventListener('controllerchange', () => r(true), { once: true })),
        new Promise((r) => setTimeout(() => {
          console.warn('[web-build] no Service Worker controlling this page — addon images will 404')
          r(false)
        }, 15000))
      ])
    }
  }
  return swReadyPromise
}

// --- promises API -----------------------------------------------------------------------------

async function readdir (dir) {
  const key = norm(dir)
  if (isUser(key)) {
    // Offline build: report no downloaded add-ons. Without a Service Worker their images cannot be
    // served, so listing them would unlock the full expansion list (store.hasClassicAddon, see
    // TileSetsTab) while every tile 404s. A `classic` left in IndexedDB by an earlier normal-build
    // visit to this origin is the usual culprit. IndexedDB itself is left untouched.
    if (NO_SW) return []
    await swReady()
    try { return await opfs.readdir(key) } catch (e) { throw enoent(dir) }
  }
  const m = await manifest()
  if (m[key] !== 'd') throw enoent(dir)
  const prefix = key === '/' ? '/' : key + '/'
  const names = new Set()
  for (const k of Object.keys(m)) {
    if (!k.startsWith(prefix) || k === key) continue
    const rest = k.slice(prefix.length)
    if (!rest || rest.includes('/')) continue
    names.add(rest)
  }
  return [...names]
}

async function stat (p) {
  const key = norm(p)
  if (isUser(key)) {
    await swReady()
    try { return await opfs.stat(key) } catch (e) { throw enoent(p) }
  }
  const m = await manifest()
  const entry = m[key]
  if (entry === undefined) throw enoent(p)
  const isDir = entry === 'd'
  return { isDirectory: () => isDir, isFile: () => !isDir, size: isDir ? 0 : entry }
}

async function readFile (p) {
  const key = norm(p)
  if (isUser(key)) {
    // the artwork loader reads JSON here, then emits image URLs the SW must serve
    await swReady()
    try { return await opfs.readText(key) } catch (e) { throw enoent(p) }
  }
  const m = await manifest()
  if (m[key] === undefined || m[key] === 'd') throw enoent(p)
  const res = await fetch(resourceUrl(key))
  if (!res.ok) throw enoent(p)
  return res.text()
}

async function access (p) {
  const key = norm(p)
  // The engine is a Web Worker, not a file, but the app probes it before running --version.
  if (key.endsWith('jcz-engine.js')) return
  if (isUser(key)) {
    if (await opfs.exists(key)) return
    throw enoent(p)
  }
  const m = await manifest()
  if (m[key] === undefined) throw enoent(p)
}

export const promises = {
  readdir,
  stat,
  readFile,
  access,
  mkdir: async (p) => { if (isUser(p)) await opfs.mkdirp(p) },
  writeFile: async (p, data) => { if (!isUser(p)) throw new Error('read-only: ' + p); await opfs.writeFile(p, data) },
  rm: async (p) => { memory.delete(norm(p)); if (isUser(p)) { try { await opfs.rm(p) } catch (e) {} } },
  unlink: async (p) => { memory.delete(norm(p)); if (isUser(p)) { try { await opfs.rm(p) } catch (e) {} } },
  rename: async (from, to) => {
    // no rename in the store; copy the tree then drop the source.
    const copy = async (src, dst) => {
      if (await opfs.isDirectory(src)) {
        await opfs.mkdirp(dst)
        for (const name of await opfs.readdir(src)) await copy(src + '/' + name, dst + '/' + name)
      } else {
        await opfs.writeFile(dst, await opfs.readBytes(src))
      }
    }
    await copy(norm(from), norm(to))
    try { await opfs.rm(from) } catch (e) {}
  },
  mkdtemp: async (prefix) => {
    const dir = norm(prefix) + Math.random().toString(36).slice(2, 8)
    await opfs.mkdirp(dir)
    return dir
  }
}

export const constants = { R_OK: 4, W_OK: 2, F_OK: 0 }

// --- minimal Node streams (enough for plugins/addons.js) --------------------------------------

class Writable {
  constructor (path) {
    this.path = norm(path)
    this.chunks = []
    this.handlers = {}
    this.bytes = 0
  }
  on (ev, cb) { (this.handlers[ev] || (this.handlers[ev] = [])).push(cb); return this }
  once (ev, cb) { return this.on(ev, cb) }
  emit (ev, ...a) { (this.handlers[ev] || []).forEach((cb) => cb(...a)) }
  write (chunk) {
    const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
    this.chunks.push(u8)
    this.bytes += u8.length
    return true
  }
  _flat () {
    const out = new Uint8Array(this.bytes)
    let o = 0
    for (const c of this.chunks) { out.set(c, o); o += c.length }
    return out
  }
  async end () {
    const data = this._flat()
    memory.set(this.path, data)             // keep for the synchronous sha256 check
    try {
      await opfs.writeFile(this.path, data)
      this.emit('finish')
    } catch (e) {
      this.emit('error', e)
    }
  }
  close (cb) { this.end().then(() => cb && cb()) }
  destroy () { this.chunks = [] }
}

class Readable {
  constructor (path) { this.path = norm(path); this.handlers = {} }
  on (ev, cb) { (this.handlers[ev] || (this.handlers[ev] = [])).push(cb); return this }
  emit (ev, ...a) { (this.handlers[ev] || []).forEach((cb) => cb(...a)) }
  pipe (dest) {
    const bytes = memory.get(this.path)
    const go = async () => {
      try {
        const data = bytes || await opfs.readBytes(this.path)
        dest.write(data)
        await (dest.end ? dest.end() : Promise.resolve())
      } catch (e) {
        dest.emit ? dest.emit('error', e) : this.emit('error', e)
      }
    }
    go()
    return dest
  }
}

export const createWriteStream = (p) => new Writable(p)
export const createReadStream = (p) => new Readable(p)

export const unlink = (p, cb) => { promises.unlink(p).then(() => cb && cb(null)).catch((e) => cb && cb(e)) }

// Sync API — cannot be backed by async storage. Nothing on the boot path uses it.
export const existsSync = () => false
export const readdirSync = () => []
export const mkdirSync = () => {}
const boom = (n) => () => { throw new Error('[web-build] fs.' + n + ' (sync) is not available in the browser') }
export const statSync = boom('statSync')
export const readFileSync = boom('readFileSync')
export const writeFileSync = boom('writeFileSync')

export default {
  promises, constants,
  createReadStream, createWriteStream, unlink,
  existsSync, readdirSync, mkdirSync, statSync, readFileSync, writeFileSync
}
