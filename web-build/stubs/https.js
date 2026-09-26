// Node `https` for the browser — only the `get()` shape plugins/addons.js uses when an addon is
// hosted over plain HTTPS (rather than Mega).
//
// ⚠️ Cross-origin downloads only work if the host sends CORS headers. Verified from a browser:
//     mega.nz (API + storage nodes)      -> CORS OK  (their own web client is browser-based)
//     github release downloads           -> BLOCKED
//     jcloisterzone.com/packages/...     -> BLOCKED
// So HTTPS-provider addons need to be served from a CORS-enabled origin before this path can work.
class Response_ {
  constructor (headers) {
    this.headers = headers
    this.handlers = {}
  }
  on (ev, cb) { (this.handlers[ev] || (this.handlers[ev] = [])).push(cb); return this }
  emit (ev, ...a) { (this.handlers[ev] || []).forEach((cb) => cb(...a)) }
  pipe (dest) { this.dest = dest; return dest }
}

export function get (url, opts, cb) {
  const callback = typeof opts === 'function' ? opts : cb
  const req = { on: () => req }

  ;(async () => {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const res = new Response_({ 'content-length': r.headers.get('content-length') })
      if (callback) callback(res)

      const buf = new Uint8Array(await r.arrayBuffer())
      const CHUNK = 512 * 1024
      for (let o = 0; o < buf.length; o += CHUNK) {
        const chunk = buf.subarray(o, Math.min(o + CHUNK, buf.length))
        res.emit('data', chunk)
        if (res.dest) res.dest.write(chunk)
        await new Promise((r2) => setTimeout(r2, 0))
      }
      if (res.dest && res.dest.end) await res.dest.end()
    } catch (e) {
      req._err && req._err(e)
    }
  })()

  // https.get(...).on('error', fn)
  req.on = (ev, fn) => { if (ev === 'error') req._err = fn; return req }
  return req
}

export class Agent { constructor (o) { this.options = o } }
export default { get, Agent }
