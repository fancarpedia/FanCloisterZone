// Service Worker: serve downloaded addon files out of IndexedDB.
//
// Addon artwork is referenced by ordinary hierarchical URLs (the artwork loader does
// `pathPrefix + relativePath`), so blob: URLs are no use — they aren't hierarchical. Instead we
// intercept requests under /vfs/userdata/** and answer them from the same IndexedDB store that
// stubs/storage.js writes to.
//
// /vfs/resources/** is NOT intercepted: those files ship with the app in dist/ and are fetched from
// the network like any other asset.
//
// Keep DB_NAME/STORE in sync with stubs/storage.js.
const DB_NAME = 'fcz-vfs'
const DB_VERSION = 1
const STORE = 'files'
const USERDATA_PREFIX = '/vfs/userdata/'

self.addEventListener('install', () => self.skipWaiting())

// claim() takes over clients that an OLDER worker was controlling, so a redeploy recovers without
// a manual reload. Deliberately NOT auto-navigating clients here: activation can land in the middle
// of the ~30 MB addon download, and reloading would restart it.
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', json: 'application/json',
  xml: 'application/xml', txt: 'text/plain', ogg: 'audio/ogg', mp3: 'audio/mpeg'
}

let dbPromise = null
function db () {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      // The page creates the store; if the SW gets there first, create it too so neither races.
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'path' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function fromStore (pathname) {
  // '/vfs/userdata/addons/classic/...' -> '/userdata/addons/classic/...'
  const virtual = decodeURIComponent(pathname).slice('/vfs'.length)
  const d = await db()
  const row = await new Promise((resolve, reject) => {
    const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(virtual)
    r.onsuccess = () => resolve(r.result || null)
    r.onerror = () => reject(r.error)
  })
  if (!row || row.dir || !row.blob) {
    // Loud on purpose: a miss here renders as a broken image with no clue why. The usual causes are
    // a stale SW from a previous build, or the addon download never completing on this device.
    console.warn('[fcz-sw] not in IndexedDB:', virtual)
    return new Response('not stored: ' + virtual, { status: 404 })
  }

  const ext = virtual.split('.').pop().toLowerCase()
  return new Response(row.blob, {
    status: 200,
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': String(row.blob.size),
      'Cache-Control': 'no-cache'
    }
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  const i = url.pathname.indexOf(USERDATA_PREFIX)
  if (i === -1) return // not a downloaded-addon asset — let it hit the network

  event.respondWith(
    fromStore(url.pathname.slice(i)).catch(
      (e) => new Response('vfs error: ' + (e && e.message), { status: 500 })
    )
  )
})
