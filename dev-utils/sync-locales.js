#!/usr/bin/env node

// One command for the whole locale sync. Step 1 of the pipeline:
//
//   1. download the current wiki page for every language
//   2. find the strings the wiki marks untranslated (<span class="mw-content-ltr">) or
//      outdated (<span class="mw-translate-fuzzy">)
//   3. for each of those, look in the AI translation memory (dev-utils/locale-db/<lang>.json)
//      and use the stored translation when it was made FROM the current English
//   4. anything left over is genuinely new: the <span> markup is stripped (so the file stays
//      valid JSON and shows the English / stale text) and the string is REPORTED, not invented
//   5. write src/renderer/locales/<lang>.json, never touching a key the wiki did not mark
//
// The report of what is still untranslated lands in dev-utils/locale-raw/PENDING.json and is
// printed at the end. That file is the input for step 2 (machine-translating the new strings).
//
// Nothing here translates anything by itself — it only moves text that already exists.
//
// Usage:
//   node dev-utils/sync-locales.js                 all languages
//   node dev-utils/sync-locales.js --lang sk,cs    only these
//   node dev-utils/sync-locales.js --dry-run       download + report, write no locale file
//   node dev-utils/sync-locales.js --offline       skip the wiki, use saved locale-pages/

const { execFileSync } = require('child_process')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { userAgent } = require('./user-agent')

const HERE = __dirname
const RAW_DIR = path.join(HERE, 'locale-raw')
const DB_DIR = path.join(HERE, 'locale-db')
const APP_LOCALES_DIR = path.resolve(HERE, '../src/renderer/locales')
const PENDING_FILE = path.join(RAW_DIR, 'PENDING.json')

function parseArgs (argv) {
  const args = { langs: null, dryRun: false, offline: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang' || a === '--langs') args.langs = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean)
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--offline') args.offline = true
    else if (a === '--help' || a === '-h') args.help = true
    else {
      console.error('Unknown argument: ' + a)
      process.exit(2)
    }
  }
  return args
}

function usage () {
  console.log('Download the wiki locales, fill marked strings from the AI memory, report the rest.')
  console.log('')
  console.log('  node dev-utils/sync-locales.js [--lang sk,cs] [--dry-run] [--offline]')
}

function knownLanguages () {
  return fs.readdirSync(APP_LOCALES_DIR)
    .filter(f => /^[a-z]{2}(-[A-Za-z]+)?\.json$/.test(f))
    .map(f => f.replace(/\.json$/, ''))
    .sort()
}

const BASE_URL = 'https://wikicarpedia.com'
const WIKI_PATH = 'car'
const PAGE_TITLE = 'User:Bumsakalaka/JCloisterZoneLocale'

/**
 * Which languages the wiki itself offers.
 *
 * The obvious sources — the base page and api.php — are the one part of the wiki still behind the
 * bot gate. But MediaWiki renders the page's <languages/> tag as a link list on EVERY translation
 * subpage, and those are not gated, so a rendered /en answers the question. Returns null when the
 * request fails, so the caller can carry on with the languages it already has.
 */
function discoverFromWiki () {
  const url = BASE_URL + '/' + WIKI_PATH + '/' + PAGE_TITLE + '/en'
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': userAgent() } }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', c => { body += c })
      res.on('end', () => {
        if (res.statusCode !== 200 || /Making sure you.{0,8}re not a bot/i.test(body)) {
          resolve(null)
          return
        }
        const found = [...body.matchAll(/JCloisterZoneLocale\/([a-z]{2}(?:-[A-Za-z]+)?)(?=["#?&]|\b)/gi)]
          .map(m => m[1].toLowerCase())
        const langs = [...new Set(found)].sort()
        resolve(langs.length ? langs : null)
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(20000, () => { req.destroy(); resolve(null) })
  })
}

/** Run one of the sibling scripts and hand back its output; never throws on a non-zero exit. */
function run (script, scriptArgs) {
  try {
    const out = execFileSync(process.execPath, [path.join(HERE, script), ...scriptArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { ok: true, out }
  } catch (err) {
    return { ok: false, out: (err.stdout || '') + (err.stderr || '') }
  }
}

/**
 * The @version on the downloaded wiki page (locale-raw/<lang>.raw.json), as the translators left
 * it. The wiki wraps a stale value in <span class="mw-translate-fuzzy"> and an untranslated one in
 * <span … class="mw-content-ltr">: the markup is stripped and the state appended, e.g.
 * "0.11.4 (outdated)". null when the page or the field is missing.
 */
function wikiVersion (lang) {
  let raw
  try {
    raw = fs.readFileSync(path.join(RAW_DIR, lang + '.raw.json'), 'utf8')
  } catch (e) {
    return null
  }
  // the value runs to the end of its line; the span markup inside it has its own quotes
  const m = /"@version"\s*:\s*"(.*)",?\s*$/m.exec(raw)
  if (!m) return null
  const value = m[1].replace(/<[^>]*>/g, '').trim()
  if (/mw-translate-fuzzy/.test(m[1])) return value + ' (outdated)'
  if (/mw-content-ltr/.test(m[1])) return value + ' (untranslated)'
  return value
}

const num = (out, re) => {
  const m = re.exec(out)
  return m ? parseInt(m[1], 10) : 0
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  const known = knownLanguages()
  let langs = args.langs && args.langs.length ? args.langs : known
  const brandNew = []

  // Ask the wiki which languages exist, unless the caller named them explicitly.
  if (!args.langs && !args.offline) {
    const onWiki = await discoverFromWiki()
    if (!onWiki) {
      console.log('Could not read the language list from the wiki — using the files already here.')
      console.log('(a language added on the wiki since the last run will not be noticed)')
    } else {
      const added = onWiki.filter(l => !known.includes(l))
      const gone = known.filter(l => !onWiki.includes(l))
      console.log('On the wiki: ' + onWiki.length + ' language(s)')
      if (added.length) {
        console.log('')
        console.log('NEW LANGUAGE ON THE WIKI: ' + added.join(', '))
        console.log('  No locale file here yet — it will be created from the page.')
        console.log('')
        brandNew.push(...added)
      }
      if (gone.length) {
        console.log('Here but not on the wiki (left untouched): ' + gone.join(', '))
      }
      langs = [...new Set([...onWiki, ...known.filter(l => !gone.includes(l))])].sort()
    }
  }

  console.log('Languages : ' + langs.join(', '))
  console.log('Locale dir: ' + APP_LOCALES_DIR)
  console.log('Memory    : ' + DB_DIR)
  if (args.dryRun) console.log('Mode      : dry run — no locale file will be written')
  console.log('')

  // --- 1. download -----------------------------------------------------------------------------
  // update-locales-download.js tries the wiki first and falls back to a page saved in
  // locale-pages/, so --offline is only about not attempting the network at all.
  console.log('[1/3] downloading ' + langs.length + ' page(s) + the English source')
  const toFetch = langs.includes('en') ? langs : ['en', ...langs]
  const dl = run('update-locales-download.js', ['--lang', toFetch.join(',')])
  // per language: where the page came from ('wiki' or the saved file's name) and whether it
  // differs from the previous run's copy - the download script prints
  //   '<lang>: written|unchanged from <origin> (...)'
  const pages = {}
  for (const line of dl.out.split(/\r?\n/)) {
    if (/^[a-z]{2}(-[A-Za-z]+)?:/.test(line) || /^(Got|Missing)/.test(line)) console.log('  ' + line)
    const m = /^([a-z]{2}(?:-[A-Za-z]+)?): (written|unchanged) from (\S+)/.exec(line)
    if (m) pages[m[1]] = { changed: m[2] === 'written', fromWiki: m[3] === 'wiki', origin: m[3] }
  }
  if (!dl.ok) {
    console.error('')
    console.error('Download step failed. Nothing was written.')
    process.exit(1)
  }

  // --- 2 + 3. fill from memory, install, collect what is still pending -------------------------
  console.log('')
  console.log('[2/3] filling marked strings from the AI memory' + (args.dryRun ? ' (report only)' : ' and installing'))
  const rows = []
  const pending = {}
  for (const lang of langs) {
    if (!fs.existsSync(path.join(RAW_DIR, lang + '.raw.json'))) {
      rows.push({ lang, error: 'no page downloaded or saved' })
      continue
    }
    // A language the wiki has but we do not: --install refuses to write a file that is not there,
    // so seed it. buildFromEnShape then fills it from en.json's key set + the page's values.
    const target = path.join(APP_LOCALES_DIR, lang + '.json')
    if (!args.dryRun && !fs.existsSync(target)) {
      fs.writeFileSync(target, '{}' + String.fromCharCode(10), 'utf8')
    }

    // the work list first: it is what step 2 consumes, and it is produced either way
    const todo = run('translate-locales.js', ['--lang', lang, '--todo'])
    const todoFile = path.join(RAW_DIR, lang + '.todo.json')
    let items = {}
    if (todo.ok && fs.existsSync(todoFile)) {
      try {
        items = JSON.parse(fs.readFileSync(todoFile, 'utf8'))
      } catch (e) {
        items = {}
      }
    }
    const stillNew = Object.entries(items).filter(([, v]) => !v.value)
    if (stillNew.length) {
      pending[lang] = stillNew.map(([keyPath, v]) => ({ keyPath, kind: v.kind, en: v.en, stale: v.stale }))
    }

    const res = run('translate-locales.js', ['--lang', lang, ...(args.dryRun ? [] : ['--install'])])
    if (!res.ok) {
      rows.push({ lang, error: (res.out.split(/\r?\n/).find(l => l.trim()) || 'failed').trim() })
      continue
    }
    rows.push({
      lang,
      fromMemory: num(res.out, /from memory\s*:\s*(\d+)/),
      needs: num(res.out, /needs translating:\s*(\d+)/),
      filled: num(res.out, /filled from memory \/ metadata\s*:\s*(\d+)/),
      human: num(res.out, /updated from the wiki page \(human\):\s*(\d+)/),
      changed: num(res.out, /total values changed\s*:\s*(\d+)/),
      page: pages[lang] || null,
      version: wikiVersion(lang)
    })
  }

  // --- still untranslated (details first, so the statistics below are the last thing printed) --
  const pendingLangs = Object.keys(pending)
  const pendingTotal = pendingLangs.reduce((n, l) => n + pending[l].length, 0)
  if (pendingTotal) {
    if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true })
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2) + '\n', 'utf8')
    console.log('')
    console.log('Still untranslated, written to ' + PENDING_FILE + ':')
    console.log('')
    for (const lang of pendingLangs) {
      const items = pending[lang]
      console.log('  ' + lang + ' (' + items.length + '):')
      for (const it of items.slice(0, 5)) {
        console.log('    [' + it.kind + '] ' + it.keyPath)
        console.log('        en: ' + JSON.stringify(it.en))
        if (it.stale) console.log('        stale: ' + JSON.stringify(it.stale))
      }
      if (items.length > 5) console.log('    … and ' + (items.length - 5) + ' more')
    }
    console.log('')
    console.log('These keep the English (or the stale translation) with the <span> markup stripped,')
    console.log('so the locale files stay valid. Translate them, then feed them back with:')
    console.log('  node dev-utils/translate-locales.js --lang <code> --merge <file> ')
    console.log('  node dev-utils/translate-locales.js --lang <code> --install')
  } else if (fs.existsSync(PENDING_FILE)) {
    fs.unlinkSync(PENDING_FILE)
  }

  // --- statistics: always the very last output ------------------------------------------------
  console.log('')
  console.log('[3/3] summary')
  console.log('')
  // source: where the page came from this run; page: whether it differs from the last run's copy
  // wiki @version: the version on the wiki page itself (what the translators worked against), not
  // the one written to the installed file (which gets the -ai suffix)
  console.log('  lang  source       page     from memory  still new  human text  changed  wiki @version')
  for (const r of rows) {
    if (r.error) {
      console.log('  ' + r.lang.padEnd(6) + 'FAILED — ' + r.error)
      continue
    }
    const source = r.page ? (r.page.fromWiki ? 'wiki' : r.page.origin) : '?'
    const page = r.page ? (r.page.changed ? 'UPDATED' : 'same') : '?'
    console.log('  ' + r.lang.padEnd(6) +
      source.padEnd(13) +
      page.padEnd(9) +
      String(r.fromMemory).padStart(8) + '   ' +
      String(r.needs).padStart(8) + '   ' +
      String(r.human).padStart(9) + '   ' +
      String(r.changed).padStart(6) + '   ' +
      (r.version || '?') +
      (brandNew.includes(r.lang) ? '   <- NEW' : ''))
  }

  const ok = rows.filter(r => !r.error && r.page)
  const updatedFromWiki = ok.filter(r => r.page.fromWiki && r.page.changed).map(r => r.lang)
  const updatedFromSaved = ok.filter(r => !r.page.fromWiki && r.page.changed).map(r => r.lang)
  const fromSavedPage = ok.filter(r => !r.page.fromWiki).map(r => r.lang)
  const localeChanged = rows.filter(r => !r.error && r.changed > 0).map(r => r.lang)
  console.log('')
  console.log('Updated from the wiki      : ' + (updatedFromWiki.join(', ') || 'none'))
  if (updatedFromSaved.length) console.log('Updated from a saved page  : ' + updatedFromSaved.join(', '))
  if (fromSavedPage.length) console.log('Not downloaded (saved page): ' + fromSavedPage.join(', '))
  // a dry run never installs, so translate-locales reports no changed values to count
  if (!args.dryRun) console.log('Locale files changed       : ' + (localeChanged.join(', ') || 'none'))
  console.log('Still untranslated         : ' + (pendingTotal
    ? pendingTotal + ' string(s) in ' + pendingLangs.join(', ')
    : 'none — every marked string was answered from the memory'))
  if (brandNew.length) {
    console.log('New on the wiki            : ' + brandNew.join(', ') +
      ' (add to LOCALES in src/renderer/constants/locales.js)')
  }

  if (rows.some(r => r.error)) process.exit(1)
}

main().catch(err => {
  console.error('Fatal error:', err && err.message ? err.message : err)
  process.exit(1)
})
