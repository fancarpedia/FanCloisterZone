// megajs for the browser.
//
// megajs ships a real browser build (dist/main.browser-es.mjs) and Mega's API + storage nodes send
// CORS headers (their own web client is browser-based), so the SAME Mega link the desktop app uses
// can be downloaded directly in the browser. Verified: the classic artwork (30.1 MB) returns HTTP
// 206 with `type: "cors"` from gfs*.userstorage.mega.co.nz.
//
// plugins/addons.js expects a Node-ish stream (`file.download().on('data').pipe(writable)`), but the
// browser build exposes `downloadBuffer()` -> Promise<Uint8Array>. Wrap it in a tiny stream shim so
// addons.js works unchanged — including its progress reporting, which is what drives the
// "Downloading classic artwork" bar on first visit.
// The ESM browser build (the UMD one attaches to a global and exports nothing to a bundler).
// webpack 4 needs `.mjs` in resolve.extensions plus a `type: 'javascript/auto'` rule — see
// nuxt.config.web.js.
import { File as MegaFile } from 'megajs/dist/main.browser-es.mjs'

// Forwards megajs' real download stream to whatever addons.js attached — its `on('data')` handler
// (which drives the progress bar) and/or a .pipe() destination (our fs stub's write stream).
class PassThrough {
  constructor () {
    this.handlers = {}
    this.dest = null
  }

  on (ev, cb) { (this.handlers[ev] || (this.handlers[ev] = [])).push(cb); return this }
  once (ev, cb) { return this.on(ev, cb) }
  emit (ev, ...a) { (this.handlers[ev] || []).forEach((cb) => cb(...a)) }

  pipe (dest) { this.dest = dest; return dest }

  _data (chunk) {
    const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
    this.emit('data', u8)          // -> addons.js: commit('downloadProgress', bytes)
    if (this.dest) this.dest.write(u8)
  }

  async _end () {
    try {
      if (this.dest && this.dest.end) await this.dest.end()   // flushes to OPFS, emits 'finish'
      this.emit('end')
    } catch (e) {
      this.emit('error', e)
    }
  }
}

export class File {
  constructor (mega) {
    this._mega = mega
    this.size = mega.size
    this.name = mega.name
  }

  static fromURL (url) {
    return new File(MegaFile.fromURL(url))
  }

  async loadAttributes () {
    await this._mega.loadAttributes()
    this.size = this._mega.size
    this.name = this._mega.name
    return this
  }

  // Real streaming download — megajs' browser build has the same `download()` as Node
  // (downloadBuffer is literally a wrapper around it), so we get GENUINE byte-by-byte progress
  // rather than a bar that jumps to 100% at the end.
  //
  // addons.js calls download() WITHOUT awaiting loadAttributes(); the file's key/size must be
  // resolved first or the stream never settles (silently — no error, no network).
  download (opts) {
    const out = new PassThrough()
    ;(async () => {
      try {
        if (!this._mega.size) await this._mega.loadAttributes()
        this.size = this._mega.size
        const src = this._mega.download(opts || {})
        src.on('data', (chunk) => out._data(chunk))
        src.on('end', () => out._end())
        src.on('error', (e) => out.emit('error', e))
      } catch (e) {
        console.error('[web-build] Mega download failed:', e)
        out.emit('error', e)
      }
    })()
    return out
  }

  downloadBuffer (opts) {
    return this._mega.downloadBuffer(opts || {})
  }
}

export class Storage {}
export default { File, Storage }
