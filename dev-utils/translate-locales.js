#!/usr/bin/env node

// Fill in the gaps the wiki marks in a translation, using a local translation memory.
//
// Input is dev-utils/locale-raw/<lang>.raw.json as produced by update-locales-download.js,
// i.e. the locale block with the wiki's markup still in place. Two markers matter:
//
//   <span lang="en" dir="ltr" class="mw-content-ltr">…</span>   NOT TRANSLATED
//       The wiki falls back to English, so the span contains the ENGLISH text.
//
//   <span class="mw-translate-fuzzy">…</span>                   OUTDATED
//       A translation exists but the English source changed since, so the span contains the
//       STALE TRANSLATION. The current English has to be compared against it.
//
// The translation memory is dev-utils/locale-db/<lang>.json, one entry per full key path:
//
//   "button.next": { "en": "Next", "value": "Ďalej", "source": "manual" }
//
// `en` records the English text the translation was made FROM. That one field covers both
// cases: a key with no entry is new, and a key whose entry no longer matches the current
// English is outdated and needs redoing. A (key, en) pair that IS in the memory is reused
// verbatim, so the same English never gets translated twice.
//
// Usage:
//   node dev-utils/translate-locales.js --lang sk              report what is missing
//   node dev-utils/translate-locales.js --lang sk --todo       write the work list to a file
//   node dev-utils/translate-locales.js --lang sk --apply      fill spans from the memory
//
// --apply writes dev-utils/locale-raw/<lang>.filled.json (valid JSON, no markup) and leaves
// anything it cannot resolve spanned, so the output never silently claims to be translated.

const fs = require('fs')
const path = require('path')

const RAW_DIR = path.resolve(__dirname, 'locale-raw')
const DB_DIR = path.resolve(__dirname, 'locale-db')
const APP_LOCALES_DIR = path.resolve(__dirname, '../src/renderer/locales')

// Appended to @version when any value in the written locale came from the memory rather than
// from a human translator, so a glance at the file says whether it contains machine output.
const AI_VERSION_SUFFIX = '-ai'

// Private-use code points: legal inside JSON strings (unlike control characters) and absent
// from real content, so the markup can be swapped out and the block parsed as JSON.
const MARK_UNTRANSLATED = ''
const MARK_OUTDATED = ''
const MARK_END = ''

const SPAN_UNTRANSLATED = /<span lang="en" dir="ltr" class="mw-content-ltr">/g
const SPAN_OUTDATED = /<span class="mw-translate-fuzzy">/g
const SPAN_CLOSE = /<\/span>/g

/** Parse a raw locale block, keeping the wiki's markers as sentinels. */
function parseRaw (text) {
  const marked = text
    .replace(SPAN_UNTRANSLATED, MARK_UNTRANSLATED)
    .replace(SPAN_OUTDATED, MARK_OUTDATED)
    .replace(SPAN_CLOSE, MARK_END)
  try {
    return JSON.parse(marked)
  } catch (err) {
    throw new Error('could not parse as JSON after removing markup: ' + err.message)
  }
}

/** Strip every sentinel, keeping the wrapped text — what the locale looks like today. */
function plain (value) {
  return value
    .split(MARK_UNTRANSLATED).join('')
    .split(MARK_OUTDATED).join('')
    .split(MARK_END).join('')
}

function classify (value) {
  if (typeof value !== 'string') return null
  if (value.includes(MARK_UNTRANSLATED)) return 'untranslated'
  if (value.includes(MARK_OUTDATED)) return 'outdated'
  return null
}

/** Every leaf string, as [fullKeyPath, value] pairs. */
function leaves (node, prefix, out) {
  for (const key of Object.keys(node)) {
    const value = node[key]
    const full = prefix ? prefix + '.' + key : key
    if (value && typeof value === 'object' && !Array.isArray(value)) leaves(value, full, out)
    else out.push([full, value])
  }
  return out
}

function getByPath (root, keyPath) {
  let node = root
  for (const part of keyPath.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return node
}

function setByPath (root, keyPath, value) {
  const parts = keyPath.split('.')
  let node = root
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {}
    node = node[parts[i]]
  }
  node[parts[parts.length - 1]] = value
}

/**
 * Metadata, not prose: @version, @fcz-version, @jcz-version, @author. The wiki can flag these
 * as outdated when the number changes, but translating a version string is meaningless — the
 * English value is the only correct value.
 */
function isMetadata (keyPath) {
  return keyPath.startsWith('@')
}

function loadDb (lang) {
  const file = path.join(DB_DIR, lang + '.json')
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error('translation memory ' + file + ' is not valid JSON: ' + err.message)
  }
}

function saveDb (lang, db) {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
  const sorted = {}
  for (const key of Object.keys(db).sort()) sorted[key] = db[key]
  fs.writeFileSync(path.join(DB_DIR, lang + '.json'),
    JSON.stringify(sorted, null, 2) + String.fromCharCode(10), 'utf8')
}

/**
 * Work out, for every marked string, whether the memory already answers it.
 * Returns { resolved, pending, copied } keyed by full key path.
 */
function analyse (lang) {
  const rawFile = path.join(RAW_DIR, lang + '.raw.json')
  const enFile = path.join(RAW_DIR, 'en.raw.json')
  for (const f of [rawFile, enFile]) {
    if (!fs.existsSync(f)) {
      throw new Error('missing ' + f + ' — run update-locales-download.js first')
    }
  }
  const tree = parseRaw(fs.readFileSync(rawFile, 'utf8'))
  const enTree = parseRaw(fs.readFileSync(enFile, 'utf8'))
  const db = loadDb(lang)

  const resolved = []
  const pending = []
  const copied = []

  for (const [keyPath, value] of leaves(tree, '', [])) {
    const kind = classify(value)
    if (!kind) continue
    const inner = plain(value)
    const english = getByPath(enTree, keyPath)
    const englishText = typeof english === 'string' ? plain(english) : null
    // An untranslated span contains the English itself; a fuzzy one the stale translation.
    const stale = kind === 'outdated' ? inner : null
    const source = englishText !== null ? englishText : (kind === 'untranslated' ? inner : null)

    if (isMetadata(keyPath)) {
      copied.push({ keyPath, kind, value: source, stale })
      continue
    }
    const hit = db[keyPath]
    if (hit && hit.en === source && typeof hit.value === 'string') {
      resolved.push({ keyPath, kind, value: hit.value, en: source })
    } else {
      pending.push({
        keyPath,
        kind,
        en: source,
        stale,
        why: !hit ? 'not in memory' : 'memory was made from different English'
      })
    }
  }
  return { tree, enTree, db, resolved, pending, copied }
}

function parseArgs (argv) {
  const args = { lang: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang' || a === '-l') args.lang = argv[++i]
    else if (a === '--apply') args.apply = true
    else if (a === '--install') args.install = true
    else if (a === '--version-suffix') args.versionSuffix = argv[++i]
    else if (a === '--todo') args.todo = true
    else if (a === '--merge') args.merge = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function usage () {
  console.log('Fill wiki-marked gaps in a translation from a local translation memory.')
  console.log('')
  console.log('  node dev-utils/translate-locales.js --lang <code>           report')
  console.log('  node dev-utils/translate-locales.js --lang <code> --todo    write work list')
  console.log('  node dev-utils/translate-locales.js --lang <code> --apply   fill from memory')
  console.log('  node dev-utils/translate-locales.js --lang <code> --install')
  console.log('      same, but write straight into src/renderer/locales/<code>.json and')
  console.log('      mark @version with "' + AI_VERSION_SUFFIX + '" (override: --version-suffix).')
  console.log('  node dev-utils/translate-locales.js --lang <code> --merge <file>')
  console.log('      add translations to the memory. <file> maps full key path -> text,')
  console.log('      or is a --todo work list with its "value" fields filled in. The')
  console.log('      English source is taken from the analysis, never from the file, so')
  console.log('      an entry can never be stored against the wrong English.')
  console.log('')
  console.log('Raw blocks  : ' + RAW_DIR)
  console.log('Memory      : ' + DB_DIR + '/<code>.json')
}

function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.lang) {
    usage()
    return
  }
  const lang = args.lang
  const { tree, db, resolved, pending, copied } = analyse(lang)
  // every key the wiki itself flagged, the only keys machine text may ever touch
  const markedKeys = new Set([
    ...resolved.map(item => item.keyPath),
    ...pending.map(item => item.keyPath),
    ...copied.map(item => item.keyPath)
  ])

  console.log('Language: ' + lang)
  console.log('  from memory      : ' + resolved.length)
  console.log('  needs translating: ' + pending.length)
  console.log('  metadata (copy)  : ' + copied.length)

  if (args.merge) {
    const file = path.resolve(process.cwd(), args.merge)
    if (!fs.existsSync(file)) {
      console.error('File not found: ' + file)
      process.exit(1)
    }
    const incoming = JSON.parse(fs.readFileSync(file, 'utf8'))
    // English comes from the analysis, so a stored entry always matches a real source string.
    const englishFor = new Map()
    for (const item of pending) englishFor.set(item.keyPath, item.en)
    for (const item of resolved) englishFor.set(item.keyPath, item.en)
    let added = 0
    let updated = 0
    const unknown = []
    const empty = []
    for (const keyPath of Object.keys(incoming)) {
      const raw = incoming[keyPath]
      const text = (raw !== null && typeof raw === 'object') ? raw.value : raw
      if (typeof text !== 'string' || text === '') {
        empty.push(keyPath)
        continue
      }
      if (!englishFor.has(keyPath)) {
        unknown.push(keyPath)
        continue
      }
      const en = englishFor.get(keyPath)
      const existing = db[keyPath]
      if (existing && existing.en === en && existing.value === text) continue
      if (existing) updated++
      else added++
      db[keyPath] = { en, value: text, source: 'manual' }
    }
    saveDb(lang, db)
    console.log('')
    console.log('Memory updated: ' + added + ' added, ' + updated + ' replaced, now ' +
      Object.keys(db).length + ' entries')
    if (empty.length) console.log('Skipped (no text): ' + empty.length)
    if (unknown.length) {
      console.log('Skipped (key is not marked in ' + lang + ', so nothing needs it): ' + unknown.length)
      for (const k of unknown.slice(0, 10)) console.log('  ' + k)
    }
    return
  }

  if (args.todo) {
    const todoFile = path.join(RAW_DIR, lang + '.todo.json')
    const todo = {}
    for (const item of pending) {
      todo[item.keyPath] = item.kind === 'outdated'
        ? { kind: item.kind, en: item.en, stale: item.stale, why: item.why, value: '' }
        : { kind: item.kind, en: item.en, why: item.why, value: '' }
    }
    fs.writeFileSync(todoFile, JSON.stringify(todo, null, 2) + String.fromCharCode(10), 'utf8')
    console.log('')
    console.log('Work list -> ' + todoFile)
    console.log('Fill in each "value", then merge it into ' + path.join(DB_DIR, lang + '.json'))
    return
  }

  if (!args.apply && !args.install) {
    const show = pending.slice(0, 25)
    if (show.length) {
      console.log('')
      console.log('Pending (first ' + show.length + ' of ' + pending.length + '):')
      for (const item of show) {
        console.log('  [' + item.kind + '] ' + item.keyPath)
        console.log('      en   : ' + JSON.stringify(item.en))
        if (item.stale) console.log('      stale: ' + JSON.stringify(item.stale))
      }
    }
    return
  }

  // Everything the memory can answer, filled in; the rest keeps the wiki's current text.
  const out = JSON.parse(JSON.stringify(tree))
  for (const [keyPath, value] of leaves(out, '', [])) {
    if (typeof value === 'string') setByPath(out, keyPath, plain(value))
  }
  for (const item of resolved) setByPath(out, item.keyPath, item.value)
  for (const item of copied) setByPath(out, item.keyPath, item.value)

  if (args.install) {
    const suffix = args.versionSuffix !== undefined ? args.versionSuffix : AI_VERSION_SUFFIX
    // Only mark the file when it really carries machine translations.
    if (resolved.length && suffix && typeof out['@version'] === 'string' &&
        !out['@version'].endsWith(suffix)) {
      out['@version'] = out['@version'] + suffix
    }
    const target = path.join(APP_LOCALES_DIR, lang + '.json')
    if (!fs.existsSync(target)) {
      console.error('No such app locale: ' + target)
      process.exit(1)
    }
    // Only wiki-marked keys may take a value from the translation memory; everything else in
    // `out` is the wiki page's own text. So a change at an unmarked key is the SOURCE being
    // newer than this repo copy (several are 10+ revisions behind) — human text arriving, not
    // machine text overwriting it. The two are counted separately; the assertion below is what
    // actually enforces 'never change an existing translation'.
    const fromMemory = new Set(resolved.map(item => item.keyPath))
    const before = JSON.parse(fs.readFileSync(target, 'utf8'))
    let filled = 0
    let syncedFromWiki = 0
    const violations = []
    for (const [keyPath, value] of leaves(out, '', [])) {
      if (getByPath(before, keyPath) === value) continue
      if (fromMemory.has(keyPath)) filled++
      else if (isMetadata(keyPath)) filled++
      else syncedFromWiki++
      // machine text must never land anywhere the wiki did not mark
      if (fromMemory.has(keyPath) && !markedKeys.has(keyPath)) violations.push(keyPath)
    }
    if (violations.length) {
      console.error('')
      console.error('REFUSING TO WRITE: memory text would land on ' + violations.length +
        ' key(s) the wiki did not mark:')
      for (const k of violations.slice(0, 20)) console.error('  ' + k)
      process.exit(1)
    }
    const changed = filled + syncedFromWiki
    const text = JSON.stringify(out, null, 2) + String.fromCharCode(10)
    JSON.parse(text)
    fs.writeFileSync(target, text, 'utf8')
    console.log('')
    console.log('Wrote ' + target)
    console.log('  filled from memory / metadata     : ' + filled)
    console.log('  updated from the wiki page (human): ' + syncedFromWiki)
    console.log('  total values changed              : ' + changed)
    console.log('  @version: ' + JSON.stringify(before['@version']) + ' -> ' + JSON.stringify(out['@version']))
    if (pending.length) {
      console.log('  still English (no memory entry): ' + pending.length)
    }
    return
  }

  const outFile = path.join(RAW_DIR, lang + '.filled.json')
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + String.fromCharCode(10), 'utf8')
  JSON.parse(fs.readFileSync(outFile, 'utf8'))

  console.log('')
  console.log('Filled ' + (resolved.length + copied.length) + ' value(s) -> ' + outFile)
  if (pending.length) {
    console.log('Still English (no memory entry): ' + pending.length)
    console.log('Run with --todo to get the list.')
  }
  console.log('Memory entries: ' + Object.keys(db).length)
}

main()
