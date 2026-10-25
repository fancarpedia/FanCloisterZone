// Bundle the TypeScript engine into a single Web Worker script for the browser build.
//
//   node web-build/build-engine-worker.js [path-to-JCloisterZoneEngine] [--version-only]
//
// --version-only resolves and validates the engine version and writes engine-version.json,
// without bundling. build.js needs this BEFORE `nuxt generate`, because the child_process stub
// does `require('../engine-version.json')` and webpack bakes that value into the app bundle —
// run only after generate, the app would report the version from the PREVIOUS build.
//
// Defaults to ../JCloisterZoneEngine (sibling of this repo). Produces:
//   web-build/dist/jcz-engine.worker.js   — engine + xmldom + all tile-definition XMLs, self-contained
//   web-build/engine-version.json         — version string, used by the fake execFile version probe
//
// The engine repo must be built first (`npm run build` there) so dist/ exists.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const args = process.argv.slice(2)
const VERSION_ONLY = args.includes('--version-only')
const ENGINE_REPO = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'JCloisterZoneEngine'))
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

// 2. engine version, for the fake `execFile --version` probe the app runs at startup.
//
// Read it from the COMPILED engine — dist/version.js holds the ENGINE_VERSION constant that is
// actually bundled into the worker below, and is what a real `jcz-engine --version` would print.
// NOT from the engine's package.json: that is the version someone INTENDS to release. Claiming
// it here is how engine-version.json ended up naming a build that never existed — the app then
// sees the expected version, concludes it already has that engine and never downloads one.
const versionJs = path.join(ENGINE_REPO, 'dist', 'version.js')
if (!fs.existsSync(versionJs)) {
  fail('No compiled version at:\n  ' + versionJs + '\n\nRun `npm run build` in ' + ENGINE_REPO)
}
const versionMatch = /ENGINE_VERSION\s*=\s*"([^"]+)"/.exec(fs.readFileSync(versionJs, 'utf8'))
if (!versionMatch) fail('Could not read ENGINE_VERSION from ' + versionJs)
const builtVersion = versionMatch[1]
const version = 'jcloisterzone-engine-ts ' + builtVersion

// A dist/ that does not match the engine's package.json was compiled from older sources, so the
// worker would ship labelled as a version that was never built from the current tree. Refuse
// rather than mislabel it (the engine's `prebuild` regenerates version.ts, so a fresh build
// always agrees).
let intendedVersion = null
try {
  intendedVersion = require(path.join(ENGINE_REPO, 'package.json')).version
} catch (e) { /* no package.json — nothing to cross-check against */ }
if (intendedVersion && intendedVersion !== builtVersion) {
  fail(
    'Engine dist/ is STALE.\n' +
    '  compiled:     ' + builtVersion + '  (' + versionJs + ')\n' +
    '  package.json: ' + intendedVersion + '\n\n' +
    'Run `npm run build` in ' + ENGINE_REPO + ' and build the web app again.'
  )
}

const VERSION_FILE = path.join(__dirname, 'engine-version.json')
const writeVersion = () => fs.writeFileSync(VERSION_FILE, JSON.stringify({ version }, null, 2))

if (VERSION_ONLY) {
  // The engine dist/ has been found and cross-checked above, so this names a version that really
  // is compiled and about to be bundled — the bundling itself happens in the full run below.
  writeVersion()
  console.log('engine version -> ' + version)
  process.exit(0)
}

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

// Only now, with a worker actually on disk, record which version it is. Writing this earlier
// meant a failed bundle left behind a version claim for a worker that was never produced —
// engine-version.json must always describe the worker that is really there.
if (!fs.existsSync(out) || fs.statSync(out).size === 0) fail('esbuild produced no worker at ' + out)
writeVersion()

console.log('\n*** ENGINE WORKER OK ***')
console.log('engine:  ' + version)
console.log('xmls:    ' + Object.keys(xmls).length + ' files inlined')
console.log('output:  ' + out + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)')
