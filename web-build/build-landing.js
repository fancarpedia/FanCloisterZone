// Assemble the deployable site: a landing page at the root, the built app under /app/.
//
//   node web-build/build-landing.js        -> web-build/site
//
// Runs AFTER a web build (`yarn build:web:offline`), which owns web-build/dist and wipes it on
// every run — hence a separate output folder rather than dropping the landing page into dist.
//
//   web-build/site/
//     index.html          <- landing/index.html (the "Play" button points at ./app/)
//     logo.svg            <- icons/FCZ logo_6.0.0.svg, the favicon
//     build-info.json     <- app/engine versions, build id, size (the landing page fetches this)
//     .nojekyll           <- GitHub Pages must not eat the _nuxt/ directory
//     app/**              <- a copy of web-build/dist
//
// Serve it with:  node web-build/serve.js --site
const fs = require('fs')
const path = require('path')

const DIST = path.join(__dirname, 'dist')
const LANDING = path.join(__dirname, 'landing')
const SITE = path.join(__dirname, 'site')
const APP = path.join(SITE, 'app')

if (!fs.existsSync(DIST) || !fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('No app build found at ' + DIST + '\nRun:  yarn build:web:offline')
  process.exit(1)
}

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true })
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name)
    const dst = path.join(to, e.name)
    if (e.isDirectory()) copyDir(src, dst)
    else fs.copyFileSync(src, dst)
  }
}

const dirSize = (dir) => {
  let bytes = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    bytes += e.isDirectory() ? dirSize(p) : fs.statSync(p).size
  }
  return bytes
}

// Start clean — a stale app/ left over from a previous (differently configured) build is exactly
// the kind of thing that ships a mix of two builds and 404s at runtime.
fs.rmSync(SITE, { recursive: true, force: true })
fs.mkdirSync(SITE, { recursive: true })

copyDir(DIST, APP)
copyDir(LANDING, SITE)

// Favicon for the landing page. The app has its own.
const logo = path.join(__dirname, '..', 'icons', 'FCZ logo_6.0.0.svg')
if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(SITE, 'logo.svg'))

// GitHub Pages runs Jekyll by default, which silently drops directories starting with `_` —
// i.e. all of _nuxt/. Harmless anywhere else.
fs.writeFileSync(path.join(SITE, '.nojekyll'), '')

// --- build facts the landing page displays -------------------------------------------------
const appInfo = JSON.parse(fs.readFileSync(path.join(DIST, 'version.json'), 'utf8'))

let engineVersion = null
const enginePath = path.join(__dirname, 'engine-version.json')
if (fs.existsSync(enginePath)) {
  // stored as "jcloisterzone-engine-ts 7.0.0-alpha.13" — show just the number
  const raw = JSON.parse(fs.readFileSync(enginePath, 'utf8')).version || ''
  engineVersion = raw.split(/\s+/).pop() || null
}

// The offline variant skips the Service Worker entirely — build.js injects the registration snippet
// only when add-ons are downloaded. Ask the built index.html, not the filesystem: `nuxt generate`
// leaves unknown files in dist/ alone, so a stale sw.js from an earlier non-offline build survives
// and would misreport the variant.
const offline = !fs.readFileSync(path.join(APP, 'index.html'), 'utf8').includes('serviceWorker')

const info = {
  appVersion: appInfo.appVersion,
  engineVersion,
  buildId: appInfo.buildId,
  variant: offline ? 'offline' : 'web',
  sizeMb: (dirSize(APP) / 1048576).toFixed(1),
  builtAt: new Date().toISOString().slice(0, 10)
}
fs.writeFileSync(path.join(SITE, 'build-info.json'), JSON.stringify(info, null, 2))

console.log('\n*** SITE OK (landing + ' + info.variant + ' app) ***')
console.log('output: ' + SITE + '  (' + info.sizeMb + ' MB)')
console.log('app:    ' + info.appVersion + ', engine ' + (info.engineVersion || '?') + ', build ' + info.buildId)
if (!offline) {
  console.log('note:   this is the DOWNLOADING web build (sw.js present).')
  console.log('        For the self-contained one: yarn build:web:offline && yarn build:web:landing')
}
console.log('serve:  node web-build/serve.js --site')
