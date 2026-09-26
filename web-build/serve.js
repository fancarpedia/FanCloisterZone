// Serve web-build/dist over plain HTTP (no dependencies).
//
//   node web-build/serve.js          -> http://localhost:8080
//   node web-build/serve.js 9000     -> http://localhost:9000
//   node web-build/serve.js --site   -> serve web-build/site instead: landing page at /,
//                                       the app at /app/ (see build-landing.js)
//
// NOTE: this serves over http:// on purpose. The app connects to the Fan server over ws://, and a
// browser refuses ws:// from an https:// page (mixed content). Hosting this build on real https
// therefore requires the server to expose wss:// — see README.
const http = require('http')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const SITE_MODE = args.includes('--site')
const DIST = path.join(__dirname, SITE_MODE ? 'site' : 'dist')
const port = parseInt(args.find(a => /^\d+$/.test(a)) || '8080', 10)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
}

if (!fs.existsSync(DIST)) {
  console.error('No build found at ' + DIST + '\nRun:  node web-build/' +
    (SITE_MODE ? 'build-landing.js' : 'build.js'))
  process.exit(1)
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  let file = path.join(DIST, path.normalize(url).replace(/^(\.\.[/\\])+/, ''))

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')

  if (!fs.existsSync(file)) {
    // A missing ASSET must 404 — never fall back to index.html for it. Serving HTML with a 200 in
    // place of a missing image is exactly how a real bug hid here: the browser gets a page instead
    // of a JPEG and renders a broken image, while curl reports a cheerful 200. A real server
    // (nginx) 404s these, so match it. Note /vfs/userdata/** legitimately has nothing on disk —
    // it is served by the Service Worker out of IndexedDB.
    if (/\.[a-z0-9]+$/i.test(url) || url.startsWith('/vfs/') || url.startsWith('/app/vfs/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('404 not found: ' + url)
      return
    }
    // SPA fallback, routes only. In --site mode the landing page owns /, so a route under /app/
    // must fall back to the APP's index.html — handing it the landing page instead would show a
    // "Play" button where the game should be.
    file = SITE_MODE && url.startsWith('/app/')
      ? path.join(DIST, 'app', 'index.html')
      : path.join(DIST, 'index.html')
  }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    res.end(buf)
  })
}).listen(port, () => {
  console.log('FanCloisterZone (' + (SITE_MODE ? 'landing + app' : 'web build') +
    ') -> http://localhost:' + port + (SITE_MODE ? '   (app: /app/)' : ''))
  console.log('Ctrl+C to stop.')
})
