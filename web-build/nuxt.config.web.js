/* eslint no-param-reassign: 0 */
// Build the SAME renderer for a plain BROWSER instead of electron-renderer.
//
// Mirrors .electron-nuxt/renderer/nuxt.config.js with three changes:
//   1. target 'web'                 (not 'electron-renderer')
//   2. NO webpack-node-externals    (in a browser nothing can be require()d at runtime)
//   3. Node/Electron modules aliased to ./stubs
process.env.BABEL_ENV = 'renderer'

const path = require('path')
const webpack = require('webpack')
const deepmerge = require('deepmerge')

const ROOT = path.resolve(__dirname, '..')          // FanCloisterZone/
const RENDERER = path.join(ROOT, 'src', 'renderer')
const STUBS = path.join(__dirname, 'stubs')

const userNuxtConfig = require(path.join(RENDERER, 'nuxt.config'))

const baseConfig = {
  srcDir: RENDERER,
  rootDir: RENDERER,
  router: { mode: 'hash' },
  dev: false,
  telemetry: false,
  generate: { dir: path.join(__dirname, 'dist') },
  // NOTE: `build.publicPath` is deliberately NOT set — Nuxt normalizes it back to an absolute
  // '/_nuxt/'. The relative publicPath is applied on config.output in webExtend() instead.
}

const webExtend = (config) => {
  config.target = 'web'

  // RELATIVE publicPath — the single thing that makes this build portable.
  //
  // Must be set on config.output HERE, not via Nuxt's `build.publicPath`: Nuxt joins that with
  // router.base ('/') and normalizes './_nuxt/' straight back to an absolute '/_nuxt/'. Absolute
  // works only at the domain root; anywhere else every font, SVG and lazy chunk 404s (no icons,
  // no meeples).
  //
  // '_nuxt/' (no leading slash) makes webpack emit `__webpack_require__.p = "_nuxt/"`, so every
  // asset URL and every injected CSS url() resolves against the DOCUMENT — correct at the root and
  // in a subdirectory alike. Safe here because the app uses the HASH router, so the document URL
  // never changes as you navigate.
  //
  // A Nuxt plugin cannot do this: Nuxt's index.js imports App.js (and therefore every component,
  // including Meeple.vue's `require('~/assets/meeples.svg')`) BEFORE it imports plugins — the URL
  // is already baked by then.
  config.output = config.output || {}
  config.output.publicPath = '_nuxt/'

  // The Electron build leaves every dependency as a runtime require() via webpack-node-externals.
  // A browser cannot require() anything — it must all be bundled.
  config.externals = []

  config.resolve = config.resolve || {}
  config.resolve.alias = config.resolve.alias || {}
  Object.assign(config.resolve.alias, {
    electron: path.join(STUBS, 'electron.js'),
    // NOT a no-op: spawn() returns a fake process backed by a Web Worker running the TS engine,
    // so plugins/engine.js works unchanged in a browser.
    child_process: path.join(STUBS, 'child_process.js'),
    net: path.join(STUBS, 'node-empty.js'),
    // Virtual filesystem: /resources/** from dist/vfs (ships with the app), /userdata/** from OPFS
    // (addons the user downloads on first visit). Same virtual paths the app already uses.
    fs: path.join(STUBS, 'fs.js'),
    'fs-extra': path.join(STUBS, 'fs.js'),
    // graceful-fs patches fs at IMPORT time and explodes on any fs stub — it must be replaced
    // outright, not merely via the fs-extra alias above it.
    'graceful-fs': path.join(STUBS, 'fs.js'),
    // real Mega download in the browser (megajs ships a browser build; Mega sends CORS).
    // EXACT match ($) — a bare `megajs` alias also swallows the stub's own
    // `megajs/dist/...` import (webpack aliases match by prefix) and the build cannot resolve it.
    megajs$: path.join(STUBS, 'megajs.js'),
    // unzip with JSZip instead of Node-stream unzipper
    unzipper: path.join(STUBS, 'unzipper.js'),
    // synchronous sha256 of the freshly downloaded .jca
    'sha256-file': path.join(STUBS, 'sha256-file.js'),
    // https.get() over fetch (for non-Mega addon hosts)
    https: path.join(STUBS, 'https.js'),
    // the app imports node-fetch; the browser has fetch built in
    'node-fetch': path.join(STUBS, 'node-fetch.js'),
    // webpack's os polyfill lacks userInfo(), which settings.js needs
    os: path.join(STUBS, 'os.js')
  })

  // Addon assets must resolve to HTTP URLs under dist/vfs instead of file://.
  //
  // NOTE: a resolve.alias for '@/utils/asset-url' does NOT work here. Nuxt registers '@' -> srcDir
  // first, and webpack tries aliases in insertion order — '@' matches '@/utils/asset-url' as a
  // prefix and wins, so the Electron (file://) version keeps being bundled. Replace the resolved
  // module instead, which is immune to alias ordering.
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /[\\/]utils[\\/]asset-url(\.js)?$/,
      path.join(STUBS, 'asset-url.js')
    )
  )

  // megajs' browser build is an .mjs ES module written in modern syntax (optional chaining /
  // nullish coalescing) that webpack 4's parser cannot read — it fails with "Module parse failed:
  // Unexpected token". So: resolve .mjs, treat it as auto (not strict ESM), and run megajs through
  // babel. The repo's own config already babels megajs' .js for the same reason; .mjs was not
  // covered because that rule tests /\.js$/.
  config.resolve.extensions = [...(config.resolve.extensions || []), '.mjs']
  config.module.rules.push({
    test: /\.mjs$/,
    include: /node_modules[\\/]megajs/,
    type: 'javascript/auto',
    use: {
      loader: 'babel-loader',
      options: {
        presets: [['@babel/preset-env', { targets: { browsers: ['last 2 Chrome versions'] } }]],
        plugins: [
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-optional-chaining'
        ]
      }
    }
  })
  config.module.rules.push({ test: /\.mjs$/, include: /node_modules/, type: 'javascript/auto' })

  // webpack 4 auto-polyfills path/crypto/util/stream/events for the browser. Hard-disable what
  // cannot be polyfilled. NOTE: child_process is deliberately absent — it resolves to the Worker
  // engine stub above, and listing it here as 'empty' would shadow that alias.
  //
  // Buffer/global/process MUST stay on: megajs and crypto-browserify use Buffer, and assigning a
  // fresh object to config.node REPLACES webpack's defaults (Buffer: true, global: true, ...).
  // Without them megajs silently hangs mid-download — no error, no network, just nothing.
  config.node = {
    ...(config.node || {}),
    Buffer: true,
    global: true,
    process: true,
    setImmediate: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    dns: 'empty'
  }

  config.plugins.push(
    new webpack.DefinePlugin({
      global: 'window',
      'process.resourcesPath': JSON.stringify('/resources'),
      // The HELLO handshake sends `platform: process.platform` (connection.js). In a browser bare
      // `process` is webpack's polyfill, whose platform is '' — so the server logged an empty
      // platform. Report 'web' so online clients are identifiable as the browser build.
      'process.platform': JSON.stringify('web')
    })
  )

  if (process.env.WEB_BUILD_NO_MINIFY) {
    config.optimization = config.optimization || {}
    config.optimization.minimize = false
  }
}

const mergeConfig = (customConfig) => {
  const hasExtend = customConfig.build !== undefined && customConfig.build.extend !== undefined
  if (hasExtend) {
    const userExtend = customConfig.build.extend
    // The user's extend sets `externals = { fsevents: "require('fsevents')" }`, which is fatal in a
    // browser. Run it FIRST so the web overrides below win.
    customConfig.build.extend = function () {
      userExtend(...arguments)
      webExtend(...arguments)
    }
  } else {
    if (baseConfig.build === undefined) baseConfig.build = {}
    baseConfig.build.extend = webExtend
  }
  return deepmerge(baseConfig, customConfig)
}

module.exports = mergeConfig(userNuxtConfig)

// Drop @nuxtjs/vuetify's FontAwesome CDN <link>. With `defaultAssets.icons: 'fa'` the module
// injects `<link href="https://cdn.jsdelivr.net/.../fontawesome-free@latest/...">` at runtime — an
// external dependency that makes the build not self-contained (fatal for the offline variant, and
// unwanted for any web deploy). The app already bundles FontAwesome locally via plugins/icons.js,
// so this is pure redundancy: setting `icons: false` removes the CDN link and keeps the local one.
module.exports.vuetify = module.exports.vuetify || {}
module.exports.vuetify.defaultAssets = { ...(module.exports.vuetify.defaultAssets || {}), icons: false }
// ...but `defaultAssets.icons: false` also resets Vuetify's component iconfont to the default 'mdi',
// so its INTERNAL icons (checkbox tick/box, radio, dropdown chevrons, sort arrows) reference MDI
// glyphs that aren't loaded (only FontAwesome is) — they render blank (e.g. a checkbox shows only its
// focus ripple, no checked/unchecked box). Explicit `fas fa-…` icons in templates are unaffected.
// Re-assert the FontAwesome iconfont so Vuetify's own icons resolve to the bundled FA CSS.
module.exports.vuetify.icons = { ...(module.exports.vuetify.icons || {}), iconfont: 'fa' }
