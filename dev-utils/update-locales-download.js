#!/usr/bin/env node

// Download the locale pages and keep them EXACTLY as the wiki stores them.
//
// This is the sibling of update-locales.js and deliberately does less: it never writes into
// src/renderer/locales. It produces the *raw* locale blocks, with the <span> wrappers that mark
// untranslated / outdated strings still in place — update-locales.js strips those, which is
// right for producing valid JSON but throws away exactly the information you want when
// reviewing a translation.
//
// Because the markup is kept, the output is NOT valid JSON. That is the point, and it is why it
// lands outside src/renderer/locales (anything matching *.json in there is a live app locale).
//
// Two sources, in this order per language:
//   1. the wiki over HTTPS
//   2. a page you saved from your browser, in dev-utils/locale-pages/<code>.txt
//
// wikicarpedia.com currently answers every automated request with an Anubis bot challenge
// (HTTP 200 + an HTML challenge page, for ?action=raw and api.php alike), so in practice
// source 1 fails and source 2 is the working route. Run with --print-urls to get the list of
// pages to open and the filename to save each one as.
//
// Usage:
//   node dev-utils/update-locales-download.js                 all known languages
//   node dev-utils/update-locales-download.js --lang cs,sk     only these
//   node dev-utils/update-locales-download.js --print-urls     what to open, and save as what
//   node dev-utils/update-locales-download.js --help

const https = require('https')
const fs = require('fs')
const path = require('path')

// Configuration — kept identical to update-locales.js on purpose.
const BASE_URL = 'https://wikicarpedia.com'
const WIKI_PATH = 'car'
const PAGE_TITLE = 'User:Bumsakalaka/JCloisterZoneLocale'

// Where things live. All relative to this script, not to the shell's working directory.
const LOCALES_DIR = path.resolve(__dirname, '../src/renderer/locales') // read-only here: tells us which languages exist
const PAGES_DIR = path.resolve(__dirname, 'locale-pages') // INPUT: pages you saved from the browser
const RAW_DIR = path.resolve(__dirname, 'locale-raw') // OUTPUT: locale blocks with <span> kept

const LOCALE_MARKER = '== Locale file =='

/** Languages to process: every locale already in the app, so nothing is silently forgotten. */
function knownLanguages () {
  let langs = []
  try {
    langs = fs.readdirSync(LOCALES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))
      .sort()
  } catch (err) {
    console.log('Could not read ' + LOCALES_DIR + ': ' + err.message)
  }
  if (!langs.includes('en')) langs.unshift('en')
  return langs
}

function pageUrl (lang) {
  // The base page is English; translations live on /<code> subpages.
  const title = lang === 'en' ? PAGE_TITLE : PAGE_TITLE + '/' + lang
  return BASE_URL + '/' + WIKI_PATH + '/' + title + '?action=raw'
}

/**
 * Recognise an anti-bot interstitial served with HTTP 200 in place of the real content.
 * Without this the failure surfaces later as "marker not found", which sends you looking in
 * the wrong place entirely.
 */
function detectBotChallenge (body, headers) {
  const cookies = [].concat((headers || {})['set-cookie'] || []).join(';')
  if (/anubis/i.test(cookies) || /anubis|Making sure you(&#39;|')re not a bot|Oh noes!/i.test(body)) {
    return 'blocked by an anti-bot challenge (Anubis)'
  }
  const type = (headers || {})['content-type'] || ''
  if (/^\s*<(!doctype|html)/i.test(body) && !/text\/plain/.test(type)) {
    return 'server returned an HTML page instead of wiki source'
  }
  return null
}

function fetchPage (url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        if (redirectsLeft === 0) {
          reject(new Error('too many redirects'))
          return
        }
        resolve(fetchPage(new URL(res.headers.location, url).toString(), redirectsLeft - 1))
        return
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode))
          return
        }
        const challenge = detectBotChallenge(data, res.headers)
        if (challenge) {
          reject(new Error(challenge))
          return
        }
        resolve(data)
      })
    }).on('error', err => reject(err))
  })
}

/**
 * The locale block as stored: everything from the first { after the marker to its matching },
 * with <span>/<translate> markup untouched.
 *
 * Brace matching ignores braces inside strings and skips escapes, so a value containing { or }
 * cannot end the block early.
 */
function rawLocaleBlock (content) {
  const markerIndex = content.indexOf(LOCALE_MARKER)
  if (markerIndex === -1) {
    throw new Error('"' + LOCALE_MARKER + '" not found — is this the right page, saved as raw wikitext?')
  }
  const tail = content.substring(markerIndex + LOCALE_MARKER.length)
  const start = tail.indexOf('{')
  if (start === -1) {
    throw new Error('no JSON object after "' + LOCALE_MARKER + '"')
  }
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < tail.length; i++) {
    const ch = tail[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return tail.substring(start, i + 1)
    }
  }
  throw new Error('unbalanced braces — the locale block looks truncated')
}

/** How many strings the wiki flags as untranslated/outdated, i.e. why you wanted the markup. */
function countMarkup (block) {
  const spans = (block.match(/<span[^>]*>/g) || []).length
  const fuzzy = (block.match(/mw-translate-fuzzy/g) || []).length
  return { spans, fuzzy }
}

function parseArgs (argv) {
  const args = { langs: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang' || a === '-l') args.langs = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean)
    else if (a === '--print-urls') args.printUrls = true
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function usage () {
  console.log('Download locale pages, keeping the <span> markup that marks untranslated/outdated text.')
  console.log('')
  console.log('  node dev-utils/update-locales-download.js [--lang cs,sk]')
  console.log('  node dev-utils/update-locales-download.js --print-urls')
  console.log('')
  console.log('Saved pages are read from : ' + PAGES_DIR)
  console.log('Raw locale blocks land in : ' + RAW_DIR)
  console.log('')
  console.log('Nothing in src/renderer/locales is written or modified by this script.')
}

function printUrls (langs) {
  console.log('Open each page, save it as raw wikitext, and put it here:')
  console.log('  ' + PAGES_DIR)
  console.log('')
  for (const lang of langs) {
    console.log('  ' + (lang + '.txt').padEnd(10) + ' <- ' + pageUrl(lang))
  }
  console.log('')
  console.log('Then run this script again; it reads those files when the download is blocked.')
}

async function processLanguage (lang) {
  let content = null
  let origin = null

  try {
    content = await fetchPage(pageUrl(lang))
    origin = 'wiki'
  } catch (err) {
    // Expected while the site is gated — fall through to a saved page.
    const saved = ['.txt', '.wiki', '.wikitext', '']
      .map(ext => path.join(PAGES_DIR, lang + ext))
      .find(f => fs.existsSync(f) && fs.statSync(f).isFile())
    if (!saved) {
      return { lang, skipped: true, reason: err.message + ', and no saved page in locale-pages/' }
    }
    content = fs.readFileSync(saved, 'utf8')
    origin = path.basename(saved)
    const challenge = detectBotChallenge(content, {})
    if (challenge) {
      return { lang, skipped: true, reason: origin + ' is a saved challenge page, not wiki source' }
    }
  }

  const block = rawLocaleBlock(content)
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true })
  const outFile = path.join(RAW_DIR, lang + '.raw.json')
  const existed = fs.existsSync(outFile)
  const changed = !existed || fs.readFileSync(outFile, 'utf8') !== block
  if (changed) fs.writeFileSync(outFile, block, 'utf8')
  return { lang, origin, written: changed, markup: countMarkup(block), bytes: block.length }
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }
  const langs = args.langs && args.langs.length ? args.langs : knownLanguages()
  if (args.printUrls) {
    printUrls(langs)
    return
  }

  console.log('Languages: ' + langs.join(', '))
  console.log('Saved pages : ' + PAGES_DIR)
  console.log('Output      : ' + RAW_DIR)
  console.log('')

  const done = []
  const skipped = []
  for (const lang of langs) {
    try {
      const result = await processLanguage(lang)
      if (result.skipped) {
        console.log(lang + ': skipped — ' + result.reason)
        skipped.push(lang)
        continue
      }
      const m = result.markup
      console.log(lang + ': ' + (result.written ? 'written' : 'unchanged') +
        ' from ' + result.origin + ' (' + result.bytes + ' bytes, ' +
        m.spans + ' span(s), ' + m.fuzzy + ' marked outdated)')
      done.push(lang)
    } catch (err) {
      console.log(lang + ': FAILED — ' + err.message)
      skipped.push(lang)
    }
  }

  console.log('')
  console.log('Got ' + done.length + ' of ' + langs.length + ' language(s): ' + (done.join(', ') || '-'))
  if (skipped.length) {
    console.log('Missing: ' + skipped.join(', '))
    console.log('Run with --print-urls for the pages to save, then re-run.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
