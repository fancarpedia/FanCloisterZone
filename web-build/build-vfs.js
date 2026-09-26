// Ship the SMALL, app-owned trees with the distribution — exactly what Electron ships as
// extraResources (~300 KB):
//
//   process.resourcesPath + '/expansions/'   -> built-in tile-definition XMLs   (162 KB)
//   process.resourcesPath + '/addons/'       -> built-in addons (jcz)           (142 KB)
//
// Downloaded addons (classic artwork, ~32 MB) are NOT bundled. Like the desktop app, the browser
// downloads them on first visit and caches them — see stubs/storage.js. They live under
// /userdata/** in IndexedDB and are served by sw.js; stubs/fs.js routes reads to the right store.
//
//   node web-build/build-vfs.js
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
// The shipped tree lives under dist/vfs/<VFS_VER>/ so its fixed-name files (resources.svg, city.png,
// manifest.json…) get a fresh URL on every content change — the browser can't serve a stale copy
// after a redeploy. The client reads window.__FCZ_VFS_VER__ (injected by build.js) to match.
const VFS_VER = process.env.WEB_BUILD_VFS_VER || ''
const DIST_VFS = path.join(__dirname, 'dist', 'vfs', VFS_VER)

const SRC_EXPANSIONS = path.join(ROOT, 'src', 'extraResources', 'expansions')
const SRC_BUILTIN_ADDONS = path.join(ROOT, 'src', 'extraResources', 'addons')

const manifest = {} // virtual path -> 'd' (directory) | byte size (file)
let copied = 0
let bytes = 0

/** Mirror `src` to dist/vfs/<virtual>, recording every entry under its VIRTUAL path. */
function copyTree (src, virtual) {
  if (!fs.existsSync(src)) {
    console.log('  (skip, not found) ' + src)
    return
  }
  manifest[virtual] = 'd'
  const dest = path.join(DIST_VFS, virtual)
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const v = virtual + '/' + entry.name
    if (entry.isDirectory()) {
      copyTree(s, v)
    } else if (entry.isFile()) {
      const size = fs.statSync(s).size
      fs.copyFileSync(s, path.join(DIST_VFS, v))
      manifest[v] = size
      copied++
      bytes += size
    }
  }
}

fs.rmSync(DIST_VFS, { recursive: true, force: true })
fs.mkdirSync(DIST_VFS, { recursive: true })

// The virtual roots must match what the app actually asks for:
//   nuxt.config.web.js defines process.resourcesPath = '/resources'
//   build.js shims window.process.argv with --user-data=/userdata
console.log('built-in expansions:')
copyTree(SRC_EXPANSIONS, '/resources/expansions')

console.log('built-in addons:')
copyTree(SRC_BUILTIN_ADDONS, '/resources/addons')

// Replace the bundled simplified artwork's WebP textures with PNG.
//
// The `jcz/simplified` artwork (the bundled fallback / offline default) uses .webp textures. WebP in
// a browser is fragile in a way that JPEG/PNG is not: Safari refuses to render an <image> whose
// server Content-Type is not image/webp (Chrome/Firefox sniff and render anyway), and iOS Safari
// before 14 cannot decode WebP at all. Both show up as broken tiles on some devices and not others —
// exactly the reported symptom. PNG is decodable everywhere and safe under any/no MIME, so we swap.
//
// The PNGs are pre-generated in web-build/simplified-png/ (a browser canvas decoded the webp — see
// the build notes). If they are missing, keep the webp and warn rather than fail.
function swapSimplifiedWebpToPng () {
  const PNG_SRC = path.join(__dirname, 'simplified-png')
  const imgDir = '/resources/addons/jcz/simplified/images'
  const webps = Object.keys(manifest).filter((k) => k.startsWith(imgDir + '/') && k.endsWith('.webp'))
  if (!webps.length) return

  let swapped = 0
  const swappedBases = []
  for (const webpKey of webps) {
    const base = path.basename(webpKey, '.webp')
    const pngSrc = path.join(PNG_SRC, base + '.png')
    if (!fs.existsSync(pngSrc)) {
      console.log('  (keep webp, no PNG for ' + base + ' — run the conversion)')
      continue
    }
    const pngKey = webpKey.replace(/\.webp$/, '.png')
    // remove the webp, write the png
    fs.rmSync(path.join(DIST_VFS, webpKey), { force: true })
    fs.copyFileSync(pngSrc, path.join(DIST_VFS, pngKey))
    bytes += fs.statSync(pngSrc).size - manifest[webpKey]
    delete manifest[webpKey]
    manifest[pngKey] = fs.statSync(pngSrc).size
    swapped++
    swappedBases.push(base)
  }

  // Rewrite EVERY text file under the simplified addon that references a swapped texture by name.
  // Previously only artwork.json + resources.svg were rewritten, so the feature JSONs (e.g.
  // monasteries.json) kept pointing at the now-deleted garden.webp — the garden then 404'd and
  // disappeared from tiles in the web build (roads/cities survived because they use the resources.svg
  // sprite, not a raster). Only basenames actually swapped are replaced, so a kept webp stays intact.
  const simplifiedRoot = '/resources/addons/jcz/simplified/'
  const textFiles = Object.keys(manifest).filter((k) =>
    k.startsWith(simplifiedRoot) && (k.endsWith('.json') || k.endsWith('.svg')))
  for (const rel of textFiles) {
    const abs = path.join(DIST_VFS, rel)
    if (!fs.existsSync(abs)) continue
    const before = fs.readFileSync(abs, 'utf8')
    let after = before
    for (const base of swappedBases) {
      after = after.split(base + '.webp').join(base + '.png')
    }
    if (after !== before) {
      fs.writeFileSync(abs, after)
      bytes += Buffer.byteLength(after) - manifest[rel]
      manifest[rel] = Buffer.byteLength(after)
    }
  }
  console.log('simplified textures: ' + swapped + ' webp -> png (cross-browser safe)')
}
swapSimplifiedWebpToPng()

// /userdata/** is NOT shipped — the browser downloads addons into OPFS on first visit.
// Declared here only so readdir('/userdata/addons') has a root to walk before anything is installed.
manifest['/userdata'] = 'd'
manifest['/userdata/addons'] = 'd'

fs.writeFileSync(path.join(DIST_VFS, 'manifest.json'), JSON.stringify(manifest))

console.log('\n*** VFS OK ***')
console.log('shipped:  ' + copied + ' files  (' + (bytes / 1048576).toFixed(2) + ' MB)')
console.log('manifest: ' + Object.keys(manifest).length + ' entries')
console.log('output:   ' + DIST_VFS)
