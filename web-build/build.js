// Build FanCloisterZone as a static browser SPA (html/js/css) into web-build/dist.
//
//   node web-build/build.js          # minified
//   WEB_BUILD_NO_MINIFY=1 node ...   # readable names, for debugging a boot error
//
// Then serve it:  node web-build/serve.js
process.env.NODE_ENV = 'production'
process.env.BROWSERSLIST_IGNORE_OLD_DATA = '1'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Nuxt, Builder, Generator } = require('nuxt')

const config = require('./nuxt.config.web.js')
const DIST = path.join(__dirname, 'dist')

// The REAL app version. Addons declare a `minimumJczVersion` and are rejected outright if the app
// looks older — so a placeholder like "0.0.0" makes every addon fail with
// "Add-on requires JCZ x.y.z or higher", which in turn makes the loader try to re-download them.
const APP_VERSION = require('../package.json').version

// Content hash of sw.js, used to cache-bust its registration URL.
//
// Registering a bare './sw.js' is a trap: a real server (nginx/Apache) sends cache headers for it,
// so the browser can keep running the PREVIOUS Service Worker after a redeploy — and a stale SW that
// reads a storage backend the new build no longer uses answers every image with 404 (broken images,
// seen on Chrome/Android while Firefox happened to update). Registering './sw.js?v=<hash>' makes the
// script URL change whenever its contents change, which forces an update and un-sticks clients.
const SW_HASH = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname, 'sw.js')))
  .digest('hex')
  .slice(0, 12)

// Version segment for the shipped /vfs tree (tile XMLs, bundled artwork). Those files keep FIXED
// names across rebuilds (resources.svg, city.png, manifest.json…), so a browser that already loaded
// them serves stale copies after a redeploy — the app updates (its bundles are content-hashed) but
// keeps rendering the OLD artwork. Putting a content hash in the /vfs PATH (…/vfs/<VFS_VER>/…) makes
// the URLs change whenever the shipped assets change, so a rebuild is picked up with no manual cache
// clear. Hash the SOURCE of the shipped tree so the version only changes when the assets do.
const hashTree = (dir) => {
  const h = crypto.createHash('sha256')
  const walk = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else { h.update(e.name); h.update(fs.readFileSync(p)) }
    }
  }
  walk(dir)
  return h
}
const VFS_VER = hashTree(path.join(__dirname, '..', 'src', 'extraResources'))
  .update(fs.existsSync(path.join(__dirname, 'simplified-png')) ? hashTree(path.join(__dirname, 'simplified-png')).digest() : Buffer.alloc(0))
  .digest('hex')
  .slice(0, 12)

// Injected into <head> BEFORE the app bundles.
//
// `window.process` — plugins/engine.js and plugins/addons.js parse Electron's additionalArguments
// (--app-path / --user-data / --window-role) off process.argv, which a browser does not have.
//
// The error trap collects boot failures on window.__ERRORS__ so they can be inspected from the
// console (Nuxt otherwise swallows plugin errors and just fails to mount, silently).
// Offline variant: WEB_BUILD_BUNDLED_ONLY=1 ships ONLY the bundled `jcz/simplified` artwork and
// never downloads anything. No addon lives in /vfs/userdata/**, so the Service Worker (whose only
// job is serving those) is not registered — its whole IndexedDB/first-visit-reload machinery is
// simply skipped.
const BUNDLED_ONLY = !!process.env.WEB_BUILD_BUNDLED_ONLY

// Service Worker registration. Only needed when addons are downloaded (they live ONLY inside the
// worker). ?v=<hash of sw.js> busts a cached old SW on redeploy. The one-time reload matters: a page
// loaded before any worker exists is never controlled by one, so on a genuine first visit every
// downloaded-tile image 404s; reloading once, as soon as the worker activates, makes the next
// navigation controlled. Safe — it fires ~100ms in, before the ~30 MB download starts, and
// sessionStorage guards against a loop.
const SW_SNIPPET = BUNDLED_ONLY ? '' : (
  'if ("serviceWorker" in navigator) {' +
    'navigator.serviceWorker.register("./sw.js?v=' + SW_HASH + '").then(function(){' +
      'if (!navigator.serviceWorker.controller && !sessionStorage.getItem("fcz.sw-claimed")) {' +
        'navigator.serviceWorker.ready.then(function(){' +
          'if (!navigator.serviceWorker.controller) { sessionStorage.setItem("fcz.sw-claimed","1"); location.reload(); }' +
        '});' +
      '}' +
    '}).catch(function(e){ console.warn("SW registration failed", e) });' +
  '}'
)

const SHIM = '<script>' +
  'window.__APP_VERSION__=' + JSON.stringify(APP_VERSION) + ';' +
  // version segment for the shipped /vfs tree — cache-busts artwork/tile files across rebuilds
  'window.__FCZ_VFS_VER__=' + JSON.stringify(VFS_VER) + ';' +
  // versioned URL of the engine Web Worker — a FIXED-name file otherwise, so a browser keeps running
  // the OLD engine after a rebuild. Replaced below with a content-hashed filename (or the plain name
  // if the worker didn't build). stubs/child_process.js reads it.
  'window.__FCZ_ENGINE_WORKER__=__FCZ_ENGINE_WORKER_URL__;' +
  // content id of THIS build. An already-open session polls version.json and, if the deployed id
  // differs, offers a reload — otherwise active users keep running the old bundle after a redeploy.
  'window.__FCZ_BUILD_ID__=__FCZ_BUILD_ID_VALUE__;' +
  // The "Web" build badge is derived from process.platform === 'web' (utils/version.js isWeb),
  // set via window.process.platform below + the webpack define in nuxt.config.web.js — no flag here.
  // (No __FCZ_BUNDLED_ARTWORK_ONLY__ flag: web now defaults to bundled simplified and never downloads
  // add-ons regardless of variant — see utils/version.js isWeb() usage in addons.js / settings.js.)
  //
  // The offline variant ships NO Service Worker (see SW_SNIPPET above and the sw.js copy below).
  // stubs/fs.js reads this flag to:
  //   (a) skip the swReady() wait, which would otherwise block ~15s on EVERY load waiting for a
  //       controllerchange that can never fire, and
  //   (b) report /userdata as empty — downloaded add-ons live only in IndexedDB and their images
  //       are served by the SW, so without one they are unusable. A `classic` left behind by an
  //       earlier NORMAL-build visit to the same origin would otherwise still be listed, unlocking
  //       the full expansion list while every tile image 404s.
  // Deliberately scoped to the offline build: the normal web build has a SW, so a leftover classic
  // there still works and stays available.
  (BUNDLED_ONLY ? 'window.__FCZ_NO_SW__=true;' : '') +
  'window.process={' +
    // --single-window: a browser has one document, so games run in-place instead of in an OS window
    'argv:["--app-path=/","--user-data=/userdata","--app-version=" + window.__APP_VERSION__,"--window-role=main","--single-window"],' +
    'env:{NODE_ENV:"production"},cwd:function(){return "/"},execPath:"",platform:"web",' +
    'resourcesPath:"/resources",on:function(){},versions:{}' +
  '};' +
  // Suppress the browser's native right-click context menu. The desktop (Electron) app has none, and
  // the game uses right-click for actions (rotate tile / cycle action). Only preventDefault — the
  // event still propagates, so the app's own rclick handlers keep working.
  'document.addEventListener("contextmenu",function(e){e.preventDefault();});' +
  SW_SNIPPET +
  'window.__ERRORS__=[];' +
  // On-screen error overlay. Nuxt swallows Vue render errors and mobile browsers have no visible
  // console, so a crash shows as a blank white screen with no clue. This surfaces the captured
  // error as a dismissible red banner — turning "white screen" into a reportable message.
  'window.__showErr=function(msg){try{' +
    'var o=document.getElementById("__fcz_err");' +
    'if(!o){o=document.createElement("div");o.id="__fcz_err";' +
      'o.style.cssText="position:fixed;top:0;left:0;right:0;z-index:2147483647;max-height:70%;overflow:auto;' +
      'background:#b71c1c;color:#fff;font:12px/1.45 monospace;padding:12px 34px 12px 12px;white-space:pre-wrap;' +
      'word-break:break-word;-webkit-overflow-scrolling:touch;box-shadow:0 2px 8px rgba(0,0,0,.4)";' +
      'var b=document.createElement("button");b.textContent="\\u00d7";' +
      'b.setAttribute("aria-label","dismiss");' +
      'b.style.cssText="position:absolute;top:2px;right:6px;background:transparent;border:0;color:#fff;font-size:26px;line-height:1;cursor:pointer";' +
      'b.onclick=function(){o.remove()};o.appendChild(b);' +
      '(document.body||document.documentElement).appendChild(o);}' +
    'var p=document.createElement("div");p.style.marginTop="4px";p.textContent=msg;o.appendChild(p);' +
  '}catch(_){}};' +
  'window.addEventListener("error",function(e){var m="Error: "+String(e.message)+(e.filename?" ("+e.filename.split("/").pop()+":"+e.lineno+")":"");window.__ERRORS__.push({k:"error",msg:m});window.__showErr(m)});' +
  'window.addEventListener("unhandledrejection",function(e){var r=e.reason;var m="Unhandled rejection: "+String(r&&r.stack||r&&r.message||r);window.__ERRORS__.push({k:"reject",msg:m});window.__showErr(m)});' +
  '(function(){var _e=console.error;console.error=function(){' +
    'window.__ERRORS__.push({k:"console",msg:Array.prototype.map.call(arguments,function(a){return (a&&a.stack)||String(a)}).join(" ").slice(0,600)});' +
    '_e.apply(console,arguments)};})();' +
  // Watchdog: if the app is BLANK and new errors were captured, surface them. Fires only on an
  // actual blank screen, so it never bothers a working app; catches "was fine, then white-screened".
  'window.__errShown=0;setInterval(function(){try{' +
    'var nx=document.getElementById("__nuxt");' +
    'if((!nx||nx.innerText.trim().length<10)&&window.__ERRORS__.length>window.__errShown){' +
      'window.__showErr(window.__ERRORS__.slice(window.__errShown).map(function(x){return x.msg}).join("\\n"));' +
      'window.__errShown=window.__ERRORS__.length;}' +
  '}catch(_){}},2500);' +
  // New-build detector: poll version.json (bypassing cache) and, when the deployed build id no longer
  // matches this running one, show a one-time "reload" bar. Covers already-open sessions that would
  // otherwise keep the pre-redeploy bundle. Checks every 60s and whenever the tab regains focus.
  '(function(){var BID=window.__FCZ_BUILD_ID__;var shown=false;' +
    'function bar(){if(shown)return;shown=true;' +
      'var o=document.createElement("div");o.id="__fcz_upd";' +
      'o.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:#1976D2;color:#fff;' +
      'font:14px/1.4 sans-serif;padding:10px 14px;display:flex;align-items:center;justify-content:center;gap:14px;' +
      'box-shadow:0 -2px 8px rgba(0,0,0,.35)";' +
      'var t=document.createElement("span");t.textContent="A new version is available.";o.appendChild(t);' +
      'var b=document.createElement("button");b.textContent="Reload";' +
      'b.style.cssText="background:#fff;color:#1976D2;border:0;border-radius:4px;padding:6px 16px;font-weight:600;cursor:pointer";' +
      'b.onclick=function(){location.reload()};o.appendChild(b);' +
      '(document.body||document.documentElement).appendChild(o);}' +
    'function chk(){if(!BID)return;fetch("./version.json?ts="+Date.now(),{cache:"no-store"})' +
      '.then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.buildId&&j.buildId!==BID)bar();})' +
      '.catch(function(){});}' +
    'setInterval(chk,60000);' +
    'document.addEventListener("visibilitychange",function(){if(!document.hidden)chk();});' +
  '})();' +
  '</script>'

;(async () => {
  const nuxt = new Nuxt(config)
  await nuxt.ready()
  const generator = new Generator(nuxt, new Builder(nuxt))

  try {
    await generator.generate({ build: true, init: true })

    // Both sub-steps must run AFTER `generate`, which wipes dist/.
    // Non-fatal: without them the app still boots, it just cannot run games.
    const sub = (script, args, warn) => {
      try {
        require('child_process').execFileSync(
          process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' }
        )
      } catch (e) {
        console.log('\n!!! ' + warn)
      }
    }

    // Build the TS engine Web Worker FIRST (before the HTML is finalized) so we can content-hash it
    // and give it a versioned filename — otherwise its fixed name (jcz-engine.worker.js) is cached
    // and a rebuilt engine is never picked up. Then rewrite the loader URL into the SHIM below.
    sub('build-engine-worker.js', [], 'engine worker NOT built — the app boots but games will not run.\n' +
      '    Build the engine repo first (npm run build in JCloisterZoneEngine), then:\n' +
      '    node web-build/build-engine-worker.js [path-to-JCloisterZoneEngine]')

    let engineWorkerUrl = './jcz-engine.worker.js'
    const workerPlain = path.join(DIST, 'jcz-engine.worker.js')
    if (fs.existsSync(workerPlain)) {
      const ver = crypto.createHash('sha256').update(fs.readFileSync(workerPlain)).digest('hex').slice(0, 12)
      const versioned = 'jcz-engine.worker.' + ver + '.js'
      fs.renameSync(workerPlain, path.join(DIST, versioned))
      engineWorkerUrl = './' + versioned
    }

    // Content id for THIS build: the (content-hashed) app bundle filenames + the versioned assets +
    // engine worker + service worker. Changes iff any shipped code/asset changes, so identical
    // rebuilds don't nag; a real redeploy flips it and open sessions are offered a reload.
    const nuxtDir = path.join(DIST, '_nuxt')
    const nuxtList = fs.existsSync(nuxtDir) ? fs.readdirSync(nuxtDir).sort().join(',') : ''
    const BUILD_ID = crypto.createHash('sha256')
      .update(nuxtList).update(VFS_VER).update(engineWorkerUrl).update(SW_HASH)
      .digest('hex').slice(0, 12)

    for (const f of ['index.html', '200.html']) {
      const p = path.join(DIST, f)
      if (!fs.existsSync(p)) continue
      let html = fs.readFileSync(p, 'utf8')

      if (!html.includes('window.__ERRORS__')) {
        html = html.replace('<head>', '<head>' + SHIM)
      }
      // fill in the (content-hashed) engine worker URL + build id placeholders from the SHIM
      html = html.replace('__FCZ_ENGINE_WORKER_URL__', JSON.stringify(engineWorkerUrl))
      html = html.replace('__FCZ_BUILD_ID_VALUE__', JSON.stringify(BUILD_ID))

      // Nuxt's web generator doesn't emit a viewport meta here; without it mobile browsers render at
      // a ~980px desktop width and zoom out. Add the standard responsive tag (idempotent).
      if (!html.includes('name="viewport"')) {
        html = html.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1" />')
      }

      // Belt-and-braces: any absolute /_nuxt/ left in the markup becomes relative.
      html = html.replace(/(src|href)="\/_nuxt\//g, '$1="./_nuxt/')

      // THE important one. Nuxt's client.js does, at runtime:
      //     if ($config._app) __webpack_public_path__ = urlJoin(cdnURL, assetsPath)
      // and with no CDN that is urlJoin(null, './_nuxt/') === "/./_nuxt/" — i.e. ABSOLUTE. So Nuxt
      // silently overwrites webpack's relative publicPath on boot, and every font / SVG / lazy
      // chunk 404s unless the app is served from the domain root. No value of build.publicPath can
      // escape it (ufo.isRelative('_nuxt/') is false, and './_nuxt/' hits the urlJoin bug).
      //
      // Dropping `_app` from the injected runtime config skips that reset, so webpack keeps the
      // relative "_nuxt/" set via config.output.publicPath. Safe: client.js uses _app for nothing
      // else, router.js falls back to routerOptions.base, and server.js is SSR-only (ssr: false).
      html = html.replace(/_app:\{[^{}]*\},?/, '')

      fs.writeFileSync(p, html)
    }

    // Deployed-build marker the running app polls to detect a redeploy. MUST be served no-cache
    // (like index.html) so an already-open session sees the new id.
    fs.writeFileSync(path.join(DIST, 'version.json'), JSON.stringify({ buildId: BUILD_ID, appVersion: APP_VERSION }))

    // the small app-owned trees (tile-definition XMLs + built-in jcz addon), like extraResources.
    // WEB_BUILD_VFS_VER puts them under dist/vfs/<VFS_VER>/ so a rebuild cache-busts them.
    // (The engine worker was already built + versioned above, before the HTML was finalized.)
    process.env.WEB_BUILD_VFS_VER = VFS_VER
    sub('build-vfs.js', [], 'VFS NOT built — no tile definitions. Run: node web-build/build-vfs.js')

    // the Service Worker that serves downloaded addons out of IndexedDB — not needed (nor
    // registered) in the bundled-only variant, which downloads nothing.
    if (!BUNDLED_ONLY) fs.copyFileSync(path.join(__dirname, 'sw.js'), path.join(DIST, 'sw.js'))

    let bytes = 0
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else bytes += fs.statSync(p).size
      }
    }
    walk(DIST)

    console.log('\n*** WEB BUILD OK' + (BUNDLED_ONLY ? ' (bundled-only: no downloads, simplified artwork)' : '') + ' ***')
    console.log('output: ' + DIST + '  (' + (bytes / 1048576).toFixed(1) + ' MB)')
    console.log('serve:  node web-build/serve.js')
    process.exit(0)
  } catch (e) {
    console.log('\n*** WEB BUILD FAILED ***')
    console.log(e && e.stack ? e.stack.split('\n').slice(0, 20).join('\n') : String(e))
    process.exit(1)
  }
})()
