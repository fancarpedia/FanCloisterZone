// System lines in the game chat, posted by the server (1.76) when the owner changes the game before
// the start: { system: 'option', key, value } or { system: 'setup', changes: [categories] }, with the
// owner's `name` and an English `message` for apps that do not know them. Shown in the reader's
// language, WITHOUT the name (the chat shows the sender: the slot page by name, the game chat adds
// it); null for an ordinary message.

import { Expansion } from '@/models/expansions'
import { Rule } from '@/models/rules'
import { elementLocaleId } from '@/models/elements'

// the take-slot page's label of each option
const OPTION_LABELS = {
  publicGame: 'game-setup.open-game.public-game',
  randomizeSeating: 'game-setup.open-game.randomize-seating-order',
  puristTiles: 'game-setup.open-game.tournament-mode',
  maxPlayers: 'game-setup.open-game.max-players'
}

export const SETUP_CHANGE_CATEGORIES = ['sets', 'tiles', 'elements', 'rules', 'timer', 'start']

// The line in the reader's language - or null when their language pack lacks one of the texts it
// needs (then the chat shows the server's English `message`). $te: whether the reader's language
// has a text (vue-i18n $te, the current locale only); left out = all texts are there.
export const systemChatText = (m, $t, $te = null, locale = 'en') => {
  if (!m || !m.system) return null
  let missing = false
  const t = (key, params) => {
    if ($te && !$te(key)) missing = true
    return $t(key, params)
  }
  const text = localizedSystemText(m, t, $te || (() => false), locale)
  return missing ? null : text
}

// Texts the line needs go through $t (each must exist); optional ones (names) are asked with $te first.
const localizedSystemText = (m, $t, $te, locale) => {
  if (m.system === 'option') {
    const label = OPTION_LABELS[m.key]
    if (!label) return null
    const option = $t(label)
    const v = m.value
    if (typeof v === 'boolean' || v === 'true' || v === 'false') {
      const on = v === true || v === 'true'
      return $t(on ? 'chat.system.option-on' : 'chat.system.option-off', { option })
    }
    const value = (v === 0 || v === '0') ? $t('game-setup.open-game.max-players-no-limit') : v
    return $t('chat.system.option-value', { option, value })
  }
  if (m.system === 'setup') {
    // 1.78: exactly what changed (Added Phantom, Set Phantom to 3, ...)
    if (Array.isArray(m.details) && m.details.length) {
      const text = setupDetailsText(m.details, $t, $te, locale)
      if (text) return text
    }
    const changes = (m.changes || [])
      .filter(c => SETUP_CHANGE_CATEGORIES.includes(c))
      .map(c => $t('chat.system.setup-' + c))
    if (!changes.length) return null
    return $t('chat.system.setup', { changes: changes.join(', ') })
  }
  return null
}

const isOff = v => v === null || v === undefined || v === false || v === 0 || v === '0'

const formatTime = sec => {
  sec = Number(sec) || 0
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
}

// an expansion by its set id ('inns-and-cathedrals', 'basic:1', 'river/1'), as the overview names it
export const setName = (key, $t, $te) => {
  const id = String(key).replace(/:\d+$/, '')
  for (const expansion of Expansion.all()) {
    const release = expansion.releases.find(r => r.sets.includes(id))
    if (!release) continue
    const lang = 'expansion.' + (release.id || expansion.name.toLowerCase().replace(/_/g, '-'))
    if ($te(lang)) return $t(lang)
    return release.title || expansion.title
  }
  return id
}

// a game element, as its overview tile names it
export const elementName = (key, $t, $te) => {
  if (key === 'traders' && $te('game.feature.trade-goods')) return $t('game.feature.trade-goods')
  if ($te('game.feature.' + key)) return $t('game.feature.' + key)
  const id = 'game.element.' + elementLocaleId(key)
  if ($te(id)) return $t(id)
  return key.replace(/-/g, ' ')
}

// a rule's sentence ('{}' = its value), as the rules tab shows it
const ruleText = (rule, value, $t, $te) => {
  const desc = 'game-setup.variant.' + rule.id + '.description'
  if (!$te(desc)) return null
  const text = $t(desc)
  if (!text.includes('{}')) return text
  const v = 'game-setup.variant.' + rule.id + '.' + value
  return text.replace('{}', $te(v) ? $t(v) : String(value))
}

// 'A, B and C' in the reader's language
const formatList = (names, locale) => {
  if (names.length < 2) return names.join('')
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names)
  } catch (e) {
    return names.join(', ')
  }
}

// a tile by its id, with its expansion when known: 'tile BA/RCr (Base game)'
const tileName = (d, $t, $te) => {
  const tile = d.set ? d.key + ' (' + setName(d.set, $t, $te) + ')' : d.key
  return $t('chat.system.tile', { tile })
}

// one change of the setup: {kind: set|element|rule, key, from, to} | {kind: tile, key, set, from,
// to} | {kind: timer, from, to} | {kind: start}. Returns {added|removed: name} for things added /
// removed (put together into one part by setupDetailsText) or {text}.
const detailPart = (d, $t, $te) => {
  if (!d || !d.kind) return null
  if (d.kind === 'tiles') return { text: $t('chat.system.tiles') }
  if (d.kind === 'start') return { text: $t('chat.system.start') }
  if (d.kind === 'timer') {
    if (!d.to || !d.to.initial) return { text: $t('chat.system.timer-removed') }
    let value = formatTime(d.to.initial)
    if (d.to.turn) value += ' + ' + formatTime(d.to.turn)
    return { text: $t('chat.system.timer-set', { value }) }
  }
  if (d.kind === 'tile') {
    const name = tileName(d, $t, $te)
    if (d.to === null || d.to === undefined) return { text: $t('chat.system.tile-reset', { name }) }
    return { text: $t('chat.system.set-to', { name, value: d.to }) }
  }
  if (d.kind === 'rule') {
    const rule = Rule.all().find(r => r.id === d.key)
    const to = d.to ?? rule?.default
    if (rule && rule.values === Boolean) {
      const option = ruleText(rule, to, $t, $te)
      if (option) return { text: $t(to ? 'chat.system.option-on' : 'chat.system.option-off', { option: option.replace(/\.$/, '') }) }
    } else if (rule) {
      const text = ruleText(rule, to, $t, $te)
      if (text) return { text: $t('chat.system.rule', { rule: text }) }
    }
    return { text: $t('chat.system.set-to', { name: d.key, value: String(to) }) }
  }
  if (d.kind === 'set' || d.kind === 'element') {
    const name = d.kind === 'set' ? setName(d.key, $t, $te) : elementName(d.key, $t, $te)
    if (isOff(d.to)) return { removed: name }
    if (d.to === true || (isOff(d.from) && d.to === 1)) return { added: name }
    if (typeof d.to === 'number' || /^\d+$/.test(String(d.to))) return { text: $t('chat.system.set-to', { name, value: d.to }) }
    return { text: $t('chat.system.changed', { name }) }
  }
  return null
}

// one change as its own text (the added / removed thing alone)
export const setupDetailText = (d, $t, $te = () => false) => setupDetailsText([d], $t, $te)

// all changes of one edit: 'added Abbot and Garden, removed Base game, set Phantom to 3'
export const setupDetailsText = (details, $t, $te = () => false, locale = 'en') => {
  const parts = []
  const added = []
  const removed = []
  details.forEach(d => {
    const p = detailPart(d, $t, $te)
    if (!p) return
    if (p.added) {
      if (!added.length) parts.push('@added')
      if (!added.includes(p.added)) added.push(p.added)
    } else if (p.removed) {
      if (!removed.length) parts.push('@removed')
      if (!removed.includes(p.removed)) removed.push(p.removed)
    } else if (!parts.includes(p.text)) {
      parts.push(p.text)
    }
  })
  // the same thing removed and added is no change: Garden switches the edition ('basic:1' →
  // 'basic:2'), which a 1.78 server before the fix reported as Base game removed + added
  const both = added.filter(n => removed.includes(n))
  if (both.length) {
    both.forEach(n => {
      added.splice(added.indexOf(n), 1)
      removed.splice(removed.indexOf(n), 1)
    })
    if (!added.length) parts.splice(parts.indexOf('@added'), 1)
    if (!removed.length) parts.splice(parts.indexOf('@removed'), 1)
  }
  const text = parts.map(p => {
    if (p === '@added') return $t('chat.system.added', { name: formatList(added, locale) })
    if (p === '@removed') return $t('chat.system.removed', { name: formatList(removed, locale) })
    return p
  }).join(', ')
  return text || null
}
