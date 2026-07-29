// True when running the browser build. The canonical web test — use this everywhere instead of
// getBuildBadge() === 'web'. process.platform is 'web' in the web bundle (a webpack define in
// web-build/nuxt.config.web.js, plus window.process.platform at runtime) and the real OS on
// desktop, so this is a pure platform check with no injected badge flag.
export function isWeb () {
  return process.platform === 'web'
}

export function getAppVersion () {
  if (process.env.NODE_ENV === 'development') {
    return process.env.npm_package_version
  }
  return window.process.argv.find(arg => arg.startsWith('--app-version=')).replace('--app-version=', '')
}

// Which build badge (if any) this instance should display in the UI (window title,
// lobby splash, About dialog):
//   'dev'   — running from source (`yarn run dev`)
//   'alpha' — packaged pre-release build (version contains "alpha")
//   null    — stable release, no badge
export function getBuildBadge () {
  // The web build shows a "Web" badge instead of the desktop's version-derived "α Alpha" / "Dev".
  // Derived from the platform (see isWeb) — no injected flag needed.
  if (isWeb()) return 'web'
  if (process.env.NODE_ENV === 'development') return 'dev'
  try {
    return getAppVersion().includes('alpha') ? 'alpha' : null
  } catch (e) {
    return null
  }
}
