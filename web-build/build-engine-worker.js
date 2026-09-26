// Bundle the TypeScript engine into a single Web Worker script for the browser build.
//
//   node web-build/build-engine-worker.js [path-to-JCloisterZoneEngine]
//
// Defaults to ../JCloisterZoneEngine (sibling of this repo). Produces:
//   web-build/dist/jcz-engine.worker.js   — engine + xmldom + all tile-definition XMLs, self-contained
//   web-build/engine-version.json         — version string, used by the fake execFile version probe
//
// The engine repo must be built first (`npm run build` there) so dist/ exists.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ENGINE_REPO = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'JCloisterZoneEngine'))
const DIST = path.join(__dirname, 'dist')
const WORK = path.join(__dirname, 'engine-worker')

const ENGINE_DIST = path.join(ENGINE_REPO, 'dist', 'com', 'jcloisterzone')
const XMLS_DIR = path.join(ENGINE_REPO, 'xmls')

const fail = (m) => { console.error('\n*** ENGINE WORKER BUILD FAILED ***\n' + m); process.exit(1) }

if (!fs.existsSync(ENGINE_DIST)) {
  fail('Engine not built at:\n  ' + ENGINE_DIST + '\n\nRun `npm run build` in ' + ENGINE_REPO)
}
if (!fs.existsSync(XMLS_DIR)) fail('No xmls/ dir at ' + XMLS_DIR)

// 1. inline every tile-definition XML (~317 KB total — a browser has no filesystem to read them from)
const xmls = {}
for (const f of fs.readdirSync(XMLS_DIR)) {
  if (f.endsWith('.xml')) xmls[f] = fs.readFileSync(path.join(XMLS_DIR, f), 'utf8')
}
// Also inline any client-only tile-definition XMLs that live in the app's extraResources but not in
// the engine repo's xmls/ (e.g. start.xml — the base game's start tile-set). The client sends every
// one to the engine via `%load <path>`, and the worker's loadFile resolves them by basename, so a
// missing one throws "unknown tile-definition XML". Engine copies win for shared names (added only
// when absent); client-only files fill the gaps.
const CLIENT_XMLS = path.join(__dirname, '..', 'src', 'extraResources', 'expansions')
if (fs.existsSync(CLIENT_XMLS)) {
  for (const f of fs.readdirSync(CLIENT_XMLS)) {
    if (f.endsWith('.xml') && !(f in xmls)) xmls[f] = fs.readFileSync(path.join(CLIENT_XMLS, f), 'utf8')
  }
}
fs.writeFileSync(path.join(WORK, 'xmls.generated.js'), 'export default ' + JSON.stringify(xmls) + '\n')

// 2. engine version, for the fake `execFile --version` probe the app runs at startup
let version = 'unknown'
try {
  version = 'jcloisterzone-engine-ts ' + require(path.join(ENGINE_REPO, 'package.json')).version
} catch (e) { /* keep 'unknown' */ }
fs.writeFileSync(path.join(__dirname, 'engine-version.json'), JSON.stringify({ version }, null, 2))

// 3. bundle for the BROWSER (not node) as a classic worker script
fs.mkdirSync(DIST, { recursive: true })
const esbuild = path.join(ENGINE_REPO, 'node_modules', '.bin', 'esbuild' + (process.platform === 'win32' ? '.cmd' : ''))
if (!fs.existsSync(esbuild)) fail('esbuild not found in the engine repo: ' + esbuild)

const out = path.join(DIST, 'jcz-engine.worker.js')
execFileSync(esbuild, [
  path.join(WORK, 'worker-entry.js'),
  '--bundle',
  '--platform=browser',
  '--target=es2020',
  '--format=iife',
  '--alias:@engine=' + ENGINE_DIST,
  '--alias:@xmldom/xmldom=' + path.join(ENGINE_REPO, 'node_modules', '@xmldom', 'xmldom'),
  '--outfile=' + out
], { stdio: 'inherit' })

console.log('\n*** ENGINE WORKER OK ***')
console.log('engine:  ' + version)
console.log('xmls:    ' + Object.keys(xmls).length + ' files inlined')
console.log('output:  ' + out + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)')
