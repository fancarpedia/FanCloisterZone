require('./check-engines')
process.env.NODE_ENV = 'production'
// Electron renders in its own pinned Chromium — stale caniuse-lite data is irrelevant here,
// so silence browserslist's "caniuse-lite is outdated" nag (official opt-out).
process.env.BROWSERSLIST_IGNORE_OLD_DATA = '1'
require('./index')
