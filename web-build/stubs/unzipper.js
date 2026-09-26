// `unzipper` for the browser, backed by JSZip (already a dependency, and browser-native).
//
// plugins/addons.js unpacks an addon with:
//     fs.createReadStream(jca).pipe(unzipper.Extract({ path: dest })).promise()
//
// so Extract() must look like a Node writable that resolves when the archive has been written out.
// Here it collects the bytes, unzips with JSZip, and writes every entry into the store under `path`.
import JSZip from 'jszip'
import * as opfs from './storage.js'

class Extract {
  constructor ({ path }) {
    this.dest = opfs.norm(path)
    this.chunks = []
    this.bytes = 0
    this.handlers = {}
    this._done = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject })
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

  async end () {
    try {
      const buf = new Uint8Array(this.bytes)
      let o = 0
      for (const c of this.chunks) { buf.set(c, o); o += c.length }
      this.chunks = []

      const zip = await JSZip.loadAsync(buf)
      const entries = Object.values(zip.files)
      for (const entry of entries) {
        const target = this.dest + '/' + entry.name.replace(/\/+$/, '')
        if (entry.dir) {
          await opfs.mkdirp(target)
        } else {
          await opfs.writeFile(target, await entry.async('uint8array'))
        }
      }
      this.emit('finish')
      this._resolve()
    } catch (e) {
      this.emit('error', e)
      this._reject(e)
    }
  }

  close (cb) { this.end().then(() => cb && cb()) }
  destroy () { this.chunks = [] }
  promise () { return this._done }
}

export default { Extract: (opts) => new Extract(opts) }
export { Extract }
