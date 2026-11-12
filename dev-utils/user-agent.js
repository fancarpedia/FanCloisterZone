// The User-Agent the locale scripts send when downloading from wikicarpedia.com.
//
// Scope is deliberately just update-locales.js and update-locales-download.js — the app's own
// requests (updater, addon downloads, engine download) are untouched and keep their defaults.
//
// Kept OUT of git: the value lives in `.env` at the repo root (already gitignored) as
//
//   FCZ_USER_AGENT=SomeAgentName
//
// so the name the wiki operator allowlists is not published in the repository for anyone to
// spoof. `.env.example` documents the variable without carrying a value.
//
// Node sends no User-Agent of its own, which makes these requests look like an anonymous
// scraper — exactly what wikicarpedia.com's Anubis bot gate blocks. So a value is always
// returned: if `.env` is absent (a fresh clone, or CI) we fall back to a neutral, honest
// product token rather than sending nothing at all.
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

let loaded = false
function load () {
  if (loaded) return
  loaded = true
  try {
    // quiet: dotenv v17 prints a banner on every load, which would land in the middle of these
    // scripts' output (and in the webpack build log, where it is read as a warning).
    require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true })
  } catch (e) {
    // dotenv missing (or .env unreadable) is not fatal — the fallback below still applies.
  }
}

function packageVersion () {
  try {
    return require(path.join(ROOT, 'package.json')).version
  } catch (e) {
    return '0.0.0'
  }
}

/** The configured agent, or a neutral product token when `.env` does not set one. */
function userAgent () {
  load()
  const configured = (process.env.FCZ_USER_AGENT || '').trim()
  return configured || 'FanCloisterZone/' + packageVersion()
}

/** True when the value came from `.env` rather than the fallback — lets a caller warn. */
function isConfigured () {
  load()
  return !!(process.env.FCZ_USER_AGENT || '').trim()
}

module.exports = { userAgent, isConfigured }
