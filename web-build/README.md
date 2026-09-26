# FanCloisterZone — browser build (experimental)

Builds the **existing** Vue 2 / Nuxt 2 / Vuetify renderer as a plain static web app
(html + js + css), with **no changes to `src/`**. Everything here is build config and stubs.

This is a **feasibility build, not a product.** Read the limitations before judging it.

## Build

**Prerequisite — build the engine first** (the browser build bundles it into a Web Worker):

```bash
cd ../JCloisterZoneEngine && npm run build     # produces its dist/
```

Then, from the FanCloisterZone repo root:

```bash
yarn build:web      # -> web-build/dist   (static html/js/css, ~10 MB)
yarn serve:web      # -> http://localhost:8080   (or: yarn serve:web 9000)
```

### Offline variant — no downloads, bundled artwork only

```bash
yarn build:web:offline    # WEB_BUILD_BUNDLED_ONLY=1
```

Ships **only** the bundled `jcz/simplified` artwork and downloads **nothing** — no Mega, no GitHub,
no external CDN. New users default to `jcz/simplified`, `hasClassicAddon` is false, and no addon
download ever runs. Because nothing lands in `/vfs/userdata/**`, the **Service Worker is not built or
registered** at all (its whole IndexedDB / first-visit-reload machinery is skipped). The result is a
fully self-contained static site — the only network traffic is the `wss://` game connection.

Add-on behavior is now driven by the **platform**, not a variant flag: `isWeb()`
(`process.platform === 'web'`, in `utils/version.js`) makes **both** web variants default to
`jcz/simplified`, skip `updateOutdatedClassic` + `getDownloadable` (no Mega, no GitHub `addons.json`),
and suppress the "can't download classic artwork" warning in `EngineAlerts.vue`. Desktop is
unaffected (`process.platform` is the real OS). The offline variant differs from the normal web
build in that it ships **only** the `jcz/simplified` artwork in `/vfs` and skips the Service Worker
(`WEB_BUILD_BUNDLED_ONLY` / `BUNDLED_ONLY` in `build.js`). The old
`__FCZ_BUNDLED_ARTWORK_ONLY__` flag is gone.

> **`__FCZ_NO_SW__` (offline build only).** Because that variant registers no Service Worker,
> `build.js` injects `window.__FCZ_NO_SW__=true`, which `stubs/fs.js` uses to (a) resolve `swReady()`
> immediately instead of burning its 15 s timeout on every load waiting for a `controllerchange` that
> can never fire, and (b) report `/userdata` as **empty**. Downloaded add-ons live only in IndexedDB
> and their images are served *by* the SW, so without one they are unusable — and a `classic` left
> behind by an earlier **normal**-build visit to the same origin would otherwise still be listed,
> flipping `store.hasClassicAddon` to true and unlocking the full expansion list (`TileSetsTab`)
> while every tile image 404s. That was the "offline build shows all expansions in some browsers but
> only simplified in others" bug: the difference was leftover per-browser IndexedDB, not the build.
> IndexedDB is left untouched (nothing is deleted), and the normal web build is unaffected — it has a
> SW, so a leftover `classic` there still works and stays available.

### Landing page — `site/` = landing at `/`, app at `/app/`

`dist/` is the bare app: opening the root drops you straight into the lobby. To put a public face in
front of it, `build-landing.js` assembles a second folder, `web-build/site/`:

```bash
yarn build:web:site       # = build:web:offline + build:web:landing
yarn serve:site           # -> http://localhost:8080   (app at /app/)
```

```
web-build/site/
  index.html          <- landing/index.html — "Play in your browser" points at ./app/
  logo.svg            <- icons/FCZ logo_6.0.0.svg, the favicon
  build-info.json     <- app + engine version, build id, size, variant
  .nojekyll           <- GitHub Pages must not eat _nuxt/
  app/**              <- a copy of dist/
```

Edit the page itself in `web-build/landing/` — it is plain HTML with inlined CSS, no build step and
no external requests (fonts, analytics and the logo are all local or system). It lives outside
`dist/` because `nuxt generate` owns that folder.

The version numbers are **not** in the markup: the page fetches `build-info.json` at load, so a
redeploy refreshes them with no edit. Anything missing falls back to an em dash (that is also what
you get opening the file straight off disk, where `fetch` has no origin). `build-landing.js` reads
the app version and build id from `dist/version.json`, the engine version from
`web-build/engine-version.json`, and detects the **variant** by whether the built `index.html`
registers a Service Worker — offline builds don't. It warns if you assemble a site around the
*downloading* build by mistake.

`site/` is self-contained and relative-pathed like `dist/`, so the same hosting notes below apply —
just point the web root at `site/` instead. `yarn serve:web` still serves the bare `dist/`.

### WebP → PNG (cross-browser tiles)

The bundled `jcz/simplified` artwork uses `.webp` textures. WebP breaks in ways JPEG/PNG do not:
**Safari refuses an `<image>` whose server Content-Type isn't `image/webp`** (Chrome/Firefox sniff and
render anyway), and **iOS Safari < 14 can't decode WebP at all** — both appear as broken tiles on
some devices and not others. `build-vfs.js` therefore swaps simplified's 4 webp textures for PNG
(pre-generated in `web-build/simplified-png/`) and rewrites `artwork.json` + `resources.svg` to match.
PNG decodes everywhere under any/no MIME. Applies to **both** web variants (~+0.5 MB). The artwork
loader also now sets `xlink:href` alongside `href` on sprite `<image>`s, for pre-SVG2 browsers.

That's it — `dist/` is a plain static site. Nothing else is needed; the Electron build is untouched
and keeps working via `yarn build`.

`build:web` runs three steps, in order (the last two must come after Nuxt, which wipes `dist/`):

| step | output |
| --- | --- |
| `nuxt generate` (via `nuxt.config.web.js`) | `dist/_nuxt/**`, `index.html` — the app, built for `target: 'web'` |
| `build-engine-worker.js` | `dist/jcz-engine.worker.js` — the TS engine + all 47 tile XMLs, ~1 MB |
| `build-vfs.js` | `dist/vfs/**` — tile definitions + the built-in `jcz` addon, ~0.19 MB |

The engine repo is expected at `../JCloisterZoneEngine`. If it lives elsewhere, build that step
directly: `node web-build/build-engine-worker.js <path-to-JCloisterZoneEngine>`.

Debugging a boot error? Build unminified so stack traces name real modules:

```bash
WEB_BUILD_NO_MINIFY=1 yarn build:web
```

## Deploy

`dist/` is fully static — host it on nginx, Vercel, Netlify, GitHub Pages, or your own server.
Asset paths are **relative**, so it works at the domain root *and* in a subdirectory
(`https://host/fcz/`).

Deploying `site/` instead (landing page in front, see above) works the same way — the app is then a
subdirectory, so prefix the cache rules below with `/app`
(`location = /app/index.html`, `location /app/_nuxt/`, …) and keep `/index.html` +
`/build-info.json` no-cache too.

Hosting requirements:

- **HTTPS (or localhost).** The Service Worker that serves downloaded addons needs a secure context.
- **`wss://` on the Fan server.** A browser refuses `ws://` from an `https://` page (mixed content),
  so a real HTTPS deployment cannot connect until the server offers TLS. Locally it works because
  `serve.js` serves over plain `http://`.
- **Don't let `index.html`, `sw.js` or `version.json` be cached** (hashed `_nuxt/**` assets are safe
  to cache forever). `build.js` registers the worker as `./sw.js?v=<content hash>` so a redeploy forces
  an update even behind a caching server — but a cached `index.html` still hands out the *old* hash.
  A stale worker is nasty: it answers every addon image with 404, i.e. **broken images**, with the
  app otherwise working. Suggested nginx:

  ```nginx
  location = /index.html   { add_header Cache-Control "no-cache"; }
  location = /sw.js        { add_header Cache-Control "no-cache"; }
  location = /version.json { add_header Cache-Control "no-cache"; }
  location /_nuxt/         { add_header Cache-Control "public, max-age=31536000, immutable"; }
  ```

- **New-build notification.** Each build writes `version.json` = `{ buildId, appVersion }` (a content
  hash of the app bundles + versioned assets + engine/service workers), and the running app embeds its
  own `buildId`. Every 60s and whenever the tab regains focus, the app fetches `version.json`
  (cache-bypassed) and, if the deployed `buildId` differs, shows a bottom "A new version is available —
  Reload" bar. This is what gets **already-open sessions** onto a redeploy (new page loads already get
  it via the no-cache `index.html`). It only works if `version.json` isn't cached (see above).

- **Serve `.webp` as `image/webp`.** Older nginx has no webp entry in `mime.types` and falls back to
  `application/octet-stream`, which SVG `<image>` refuses to render — the `simplified` artwork is the
  only one that needs it (`classic` is all `.jpg`). Add `types { image/webp webp; }` if missing.

If a device is already stuck on an old worker, clear its site data once (Chrome Android:
⋮ → Settings → Site settings → Data stored → *your site* → Delete) — or DevTools → Application →
Service Workers → Unregister.

> **How the relative paths are achieved** (this fought back — don't undo it lightly). Nuxt's
> `client.js` overwrites webpack's publicPath on boot:
> `if ($config._app) __webpack_public_path__ = urlJoin(cdnURL, assetsPath)`. With no CDN that is
> `urlJoin(null, './_nuxt/')` === `"/./_nuxt/"` → **absolute**. So Nuxt's own relative-publicPath
> support only works behind a CDN, and **no value of `build.publicPath` escapes it**
> (`ufo.isRelative('_nuxt/')` is false; `'./_nuxt/'` hits the urlJoin bug). Hence two pieces:
> `config.output.publicPath = '_nuxt/'` (relative at build time), and `build.js` strips `_app` from
> the injected `window.__NUXT__` config so Nuxt's reset never fires. Safe: `_app` is used for nothing
> else on the client, `router.js` falls back to `routerOptions.base`, and `server.js` is SSR-only.
> Relies on the **hash router** — with history mode the document URL changes and relative paths break.

## What works

- The app **boots and renders** in a plain browser (lobby, dialogs, settings, tabs, i18n, theming).
- **Settings persist** — backed by `localStorage` instead of a settings file on disk.
- **Online connection works.** It connects to the Fan server over WebSocket, gets a session, and
  shows the lobby: open/public games, global chat, and the connected-players list.
- **The game engine runs**, in a Web Worker. The app detects it and reports its version
  (`engine: { ok: true, version: 'jcloisterzone-engine-ts 7.0.0-alpha.12' }`), and real commands
  round-trip through the *unmodified* `plugins/engine.js`, returning real `GameState` JSON.

### How the engine works without a Node process

On desktop, `plugins/engine.js` spawns the engine as a Node child process and talks to it over
**stdio** — one command line in, one JSON state line out. A browser cannot spawn processes.

Rather than rewrite the plugin, `stubs/child_process.js` makes **`spawn()` return a fake
ChildProcess** whose `stdin`/`stdout`/`stderr` are wired to a Web Worker running the engine. The
plugin cannot tell the difference, so **no app source changed**. The startup probe
(`fs.promises.access` + `execFile --version`) is answered by the stubs too.

The engine core was designed for this: it has **zero** `fs`/`path`/`node:` imports, and both host
dependencies are injected (the XML reader via `new Engine(loadFile)`, the parser via
`setDomParserFactory`). `build-engine-worker.js` bundles it with all 47 tile-definition XMLs inlined
(~317 KB) into a self-contained ~1 MB worker.

> **Worker gotcha:** `XmlUtils` defaults to `globalThis.DOMParser` ("browser global by default"), but
> **`DOMParser` does not exist in Web Worker scope** — it is a `window` API. The worker must inject
> `@xmldom/xmldom` (pure JS) explicitly, exactly as the Node host does.

### Addons: downloaded on first visit, cached in the browser

Addons are **not bundled**. Exactly like the desktop app, the browser downloads them on first visit
and caches them — a returning user loads from cache in ~1s with no re-download.

|  | size | how |
| --- | --- | --- |
| `/resources/expansions/`, `/resources/addons/` | **0.19 MB** | **shipped in `dist/vfs/`** — the same trees Electron ships as `extraResources` (tile-definition XMLs + the built-in `jcz` addon) |
| `/userdata/addons/` | **~32 MB** | **downloaded on first visit** from the same Mega link the desktop app uses, unzipped, and stored in **IndexedDB** |

`plugins/addons.js` is **unchanged** — its existing download/verify/unpack flow (including the
"Downloading classic artwork" progress bar) runs as-is. Only the primitives underneath are swapped:

| module | browser stub |
| --- | --- |
| `megajs` | the real **browser build** — Mega's API *and* storage nodes send CORS (their own web client is browser-based), so the same link works. Verified: 30.1 MB, HTTP 206, `type: "cors"`. Uses megajs' **streaming `download()`** (not `downloadBuffer`, which only resolves once the whole file has arrived) so the progress bar tracks the real transfer. |
| `unzipper` | **JSZip** (already a dependency) writing entries into IndexedDB |
| `fs` | `/resources/**` → manifest + `fetch`; `/userdata/**` → **IndexedDB** (read *and* write) |
| `sha256-file` | synchronous sha256 over the bytes just written (the app verifies the checksum synchronously) |
| `https`, `node-fetch` | `fetch` |

`sw.js` (Service Worker) serves `/vfs/userdata/**` out of IndexedDB, so the artwork loader's
ordinary `pathPrefix + relPath` URLs keep working — blob: URLs are no use here, they aren't
hierarchical. **Needs a secure context** (localhost or HTTPS).

> **Why IndexedDB and not OPFS?** OPFS is faster, but it is simply *absent* in real setups — Firefox
> private windows, older Firefox/Safari, some embedded webviews — where `navigator.storage.getDirectory`
> is undefined and there is no graceful degradation (`Error: OPFS not available in this browser`, and
> then a white screen when the setup screen finds no artwork). IndexedDB works everywhere, stores
> Blobs on disk, and is readable from the Service Worker.

Verified end-to-end from an empty browser: download → unzip → IndexedDB (393 files) → `classic ok`,
379 tiles, images served from the store (`images/BA/CRr.jpg` → 51 KB JPEG, 200). Second visit:
**1s, no re-download**.

**⚠️ The downloadable-addons catalogue (`addons.json`) is still blocked.** It is served from GitHub
releases, which does **not** send CORS headers to a browser (nor does `jcloisterzone.com/packages/…`).
Only Mega works. To offer optional addons in the browser, that catalogue must be served from a
CORS-enabled origin (e.g. the Fan server). The default `classic` artwork needs no server change.

## What does NOT work (yet)

- **Local games need the embedded WebSocket server** (`net`, still stubbed). A local game spins up a
  real WS server on localhost and connects to it. In a browser that must become an in-memory
  loopback — the same trick used for the engine (`child_process.spawn` → Web Worker).
- **Addon uninstall** and the downloadable catalogue (see the CORS note above).

Desktop-only chrome (native menus, window controls, auto-updater, multi-window) is stubbed to no-ops.
Of the 88 IPC channels the renderer uses, ~55 are that kind of chrome and never fire in a browser,
~16 are multi-window coordination, and only ~15 are load-bearing.

## How it works

`nuxt.config.web.js` mirrors `.electron-nuxt/renderer/nuxt.config.js` with three changes:

1. `target: 'web'` instead of `'electron-renderer'`
2. **no `webpack-node-externals`** — a browser cannot `require()` at runtime, so everything must bundle
3. Node/Electron modules aliased to `stubs/`

Gotchas worth knowing, each of which cost a debugging cycle:

- **`graceful-fs` must be stubbed directly**, not just `fs-extra` above it. It monkey-patches `fs` at
  *import time* (`Object.setPrototypeOf(read, fs.read)`) and dies on any fs stub — killing the app
  *before Vue mounts*, with the cryptic `Object prototype may only be an Object or null`.
- **`window.process.argv`** must be shimmed before the bundles run: `plugins/engine.js` and
  `plugins/addons.js` parse Electron's `additionalArguments` (`--app-path`, `--user-data`,
  `--window-role`).
- **`os.userInfo()`** is missing from webpack's `os` polyfill; `store/settings.js` uses it for the
  default nickname.
- The renderer's own `build.extend` sets `externals = { fsevents: "require('fsevents')" }`, which is
  fatal in a browser — the web overrides must run *after* it.
- Nuxt **silently fails to mount** when a plugin throws. `build.js` injects an error trap; inspect
  boot failures with `window.__ERRORS__`, and see what IPC the app touched with `window.__IPC__`.
- `config.node = {...}` **replaces** webpack's defaults — `Buffer`/`global`/`process` must be listed
  explicitly or megajs and crypto-browserify break (megajs hangs mid-download with no error at all).
- **Don't debug this in a headless/background tab.** `requestAnimationFrame` never fires there, so
  Vue's `<transition>` freezes at frame one: the route changes, `.page-leave` sticks, and the page
  never swaps. It looks exactly like a broken router, but it is not — it renders fine in a real
  focused browser.
