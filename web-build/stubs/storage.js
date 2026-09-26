// Persistent store for downloaded addons — the browser's stand-in for Electron's userData dir.
//
// Backed by IndexedDB, NOT OPFS. OPFS is faster, but it is simply absent in several real setups
// (Firefox private windows, older Safari/Firefox, some embedded webviews) and there is no graceful
// degradation — `navigator.storage.getDirectory` is just undefined and everything downstream dies.
// IndexedDB is available in every browser that can run this app, stores Blobs on disk (so a ~32 MB
// artwork pack is fine), and can be read from the Service Worker that serves the images.
//
// Layout: one object store keyed by the app's own virtual path ('/userdata/addons/classic/...').
// Directories are explicit rows so readdir/stat work without scanning file contents.

const DB_NAME = 'fcz-vfs'
const DB_VERSION = 1
const STORE = 'files'

export function norm (p) {
  let s = String(p).replace(/\\/g, '/')
  s = s.replace(/\/+/g, '/').replace(/\/+$/, '')
  return s || '/'
}

const USERDATA = '/userdata'
export const isUserData = (p) => norm(p).startsWith(USERDATA)

let dbPromise = null
function db () {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser'))
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'path' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      // Without this, a blocked open (another tab holding an older version, or a pending
      // deleteDatabase) never settles — and since every /userdata read awaits it, addon loading
      // hangs silently and forever with no error.
      req.onblocked = () => reject(new Error('IndexedDB open blocked — close other tabs of this app'))
      // Belt and braces: never let a wedged open stall the whole app.
      setTimeout(() => reject(new Error('IndexedDB open timed out')), 10000)
    })
  }
  return dbPromise
}

const tx = async (mode, fn) => {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    let out
    try { out = fn(store) } catch (e) { reject(e); return }
    t.oncomplete = () => resolve(out && out.__req ? out.__req.result : out)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

const get = async (path) => {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(norm(path))
    r.onsuccess = () => resolve(r.result || null)
    r.onerror = () => reject(r.error)
  })
}

// --- public API (mirrors the fs surface plugins/addons.js needs) -------------------------------

export async function mkdirp (p) {
  const segs = norm(p).split('/').filter(Boolean)
  const rows = []
  let cur = ''
  for (const s of segs) { cur += '/' + s; rows.push({ path: cur, dir: true }) }
  await tx('readwrite', (store) => { rows.forEach((r) => store.put(r)) })
}

export async function writeFile (p, data) {
  const path = norm(p)
  const parent = path.slice(0, path.lastIndexOf('/')) || '/'
  await mkdirp(parent)
  const blob = data instanceof Blob ? data : new Blob([data])
  await tx('readwrite', (store) => store.put({ path, dir: false, blob, size: blob.size }))
}

export async function readBlob (p) {
  const row = await get(p)
  if (!row || row.dir) { const e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; throw e }
  return row.blob
}

export const readText = async (p) => (await readBlob(p)).text()
export const readBytes = async (p) => new Uint8Array(await (await readBlob(p)).arrayBuffer())

export async function exists (p) { return !!(await get(p)) }
export async function isDirectory (p) { const r = await get(p); return !!(r && r.dir) }

export async function readdir (p) {
  const base = norm(p)
  const prefix = base === '/' ? '/' : base + '/'
  const d = await db()
  return new Promise((resolve, reject) => {
    const names = new Set()
    // range-scan only the keys under this directory
    const range = IDBKeyRange.bound(prefix, prefix + '￿', false, false)
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).openKeyCursor(range)
    req.onsuccess = () => {
      const c = req.result
      if (!c) { resolve([...names]); return }
      const rest = String(c.key).slice(prefix.length)
      if (rest && !rest.includes('/')) names.add(rest)
      c.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function stat (p) {
  const row = await get(p)
  if (!row) { const e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; throw e }
  return {
    isDirectory: () => !!row.dir,
    isFile: () => !row.dir,
    size: row.size || 0
  }
}

/** Remove a path and everything beneath it. */
export async function rm (p) {
  const base = norm(p)
  const prefix = base + '/'
  const d = await db()
  await new Promise((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    store.delete(base)
    const req = store.openKeyCursor(IDBKeyRange.bound(prefix, prefix + '￿', false, false))
    req.onsuccess = () => { const c = req.result; if (c) { store.delete(c.key); c.continue() } }
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
  })
}

export const hasAddon = (id) => isDirectory(USERDATA + '/addons/' + id)
