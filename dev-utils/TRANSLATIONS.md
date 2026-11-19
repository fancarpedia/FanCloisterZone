# Locale pipeline and AI completion

## Direction of flow

```
WikiCarpedia page  ->  dev-utils/locale-pages/<code>.txt   (SOURCE, saved by hand)
                   ->  dev-utils/locale-raw/<code>.raw.json (locale block, markup kept)
                   ->  dev-utils/locale-db/<code>.json      (translation memory)
                   ->  src/renderer/locales/<code>.json     (PROCESSED OUTPUT)
```

`src/renderer/locales/` is **output only**. Never read it to decide what needs translating — the repo
copies lag the wiki (see the version table below), so a value identical to English there just as often
means *translated on the wiki after the last download* as *never translated*.

## The one rule

**Never change an existing translation. Only untranslated or outdated ones.**

The only trustworthy signal is the wiki's own markup in the saved page:

| Markup | Meaning | What the span contains |
|---|---|---|
| `<span lang="en" dir="ltr" class="mw-content-ltr">` | not translated | the **English** text (wiki falls back) |
| `<span class="mw-translate-fuzzy">` | outdated | the **stale translation**; compare with current English |

Anything unmarked is a human translation and is off limits. After every `--install`, audit it: diff the
written file against the previous version and assert each changed key was marked (or is an `@` key).

`@`-prefixed keys are metadata, never translated — `@version` / `@fcz-version` take the English value,
`@author` keeps the translator's own name.

## Why pages are saved by hand

`wikicarpedia.com` is behind an Anubis proof-of-work bot gate: every URL (`?action=raw`, `api.php`,
`Special:Export`, the REST API) answers HTTP 200 with an HTML challenge page, so `yarn update-locales`
cannot download anything. A browser passes it transparently. The durable fix is to ask the wiki operator
for an Anubis allowlist on `?action=raw` for this page; then `update-locales` works untouched.

## Commands

```bash
node dev-utils/update-locales-download.js --print-urls      # URLs to open + filename to save as
yarn run update-locales-download                            # saved pages -> locale-raw/*.raw.json

node dev-utils/translate-locales.js --lang <c>              # report: marked / in memory / pending
node dev-utils/translate-locales.js --lang <c> --todo       # work list -> locale-raw/<c>.todo.json
node dev-utils/translate-locales.js --lang <c> --merge <f>  # add {key: text} to the memory
node dev-utils/translate-locales.js --lang <c> --apply      # -> locale-raw/<c>.filled.json
node dev-utils/translate-locales.js --lang <c> --install    # -> src/renderer/locales/<c>.json, @version +"-ai"
```

The memory stores `{ en, value, source }` per full key path. `en` is the English the translation was made
FROM: an unchanged English reuses the entry verbatim, a changed one invalidates it. `--merge` takes the
English from the analysis, never from the merged file, so an entry cannot be stored against the wrong
source string.

`--install` appends `-ai` to `@version` only when some value came from the memory, so the marker tells you
at a glance whether a locale file contains machine output awaiting human review.

## Status — 2026-10-27

All 14 languages are now complete. Every install reported
`updated from the wiki page (human): 0`, i.e. not one existing translation was altered.

| Lang | filled | @version | note |
|---|---|---|---|
| ca | 91 | 0.11.11-ai | fewer keys (newer translation), different key mix |
| cs | 107 | 0.11.11-ai | |
| de | 116 | 0.11.11-ai | 9 extra keys beyond the shared set |
| es | 117 | 0.11.11-ai | |
| lt | 156 | 0.11.11-ai | biggest backlog; wiki page itself stalled at 0.9.15 |
| nl | 116 | 0.11.11-ai | |
| pl | 118 | 0.11.11-ai | +1 expansion blurb |
| ru | 117 | 0.11.11-ai | |
| sk | 106 | 0.11.11-ai | first one done |
| sl | 117 | 0.11.11-ai | |
| uk | 829 | 0.11.12-ai | **new language**, from the official Ukrainian rulebooks — see UK_GLOSSARY.md |
| fr | – | 0.11.11 | 91 human values synced; no `-ai` marker |
| ro | – | 0.11.11 | 16 human values synced; no `-ai` marker |

`fr` and `ro` needed no AI work — both are fully translated by hand (Black Bear, Paloi Sciurala),
plural keys included — but they did need a plain sync of the page text into `src/renderer/locales`.
Both installed files are now byte-identical to their saved pages.

### `@version` is not a freshness signal

A page can be fully translated and freshly updated while carrying an unchanged `@version`: it tracks
the release the translator worked against, not when the text last changed. The wiki held `0.11.11`
for `fr`/`ro` while the repo sat at `0.11.6`/`0.11.9` with 90 and 15 stale English values. The only
correct test is a value-by-value comparison against the saved page — so run `--install` for every
language whose page differs from the repo copy, not just the ones carrying marked spans.

Verified across all 13 locale files: 855 keys each (identical to en.json), valid JSON, no leftover
markup, and 0 placeholder or plural-form defects in any AI-filled value.

Repo locale files were far behind the wiki when this started — wiki `en` was `0.11.11` while the repo
had `en 0.11.10`, `sk 0.11.4`, `de/es/nl/ru/sl 0.10.22`, `pl 0.10.20`, `lt 0.9.15`.

Confidence note: de, es, nl, pl, ru, cs are solid; **ca, sl and lt deserve a native review** — the
`-ai` marker on `@version` is the flag for that.

Three source-side oddities worth reporting to Bumsakalaka:
- the key `menu.feature-hints'` has a stray apostrophe in its name, on the wiki itself
- `game-setup.rules.meteorite-description` is the literal English placeholder `TBA`
- `game.tiles-progress-move` is still the English `"Tiles placed"` in **every** language
- Romanian `game-setup.variant.n-players-plural` puts the singular `jucator` in the ≥2 slot
- 14 human plural strings have too few forms — see the plural contract below

## Per-language terminology

Mined from each language's own page before translating, so additions match the existing voice rather than
inventing a parallel vocabulary.

- **sk**: meeple = *figúrka*, tile = *kartička*, feature = *oblasť*, abbey = *opátstvo*,
  expansion/add-on = *rozšírenie* / *doplnok*
- **cs**: meeple = *družiník*, tile = *kartička*, feature = *území*, abbey = *opatství*,
  monastery = *klášter*, expansion/add-on = *rozšíření* / *doplňky*, bridge = *most*
- **ro**: meeple = *Meeple* (*Meeple mic* / *Meeple mare*), tile = *cartonaș*, a game = *partidă*,
  close = *închide*

## Plural forms — the real contract

`src/renderer/plugins/vuei18n.js` defines a `pluralizationRules` entry for **every** locale, so
vue-i18n's default rule never applies. The rule increments the Gettext index and then clamps, so
**slot 0 is never selected** and a string needs **nplurals + 1** pipe-separated forms:

| forms | locales |
|---|---|
| 3 | en, ca, de, es, fr, nl |
| 4 | cs, sk, pl, ru, lt, ro |
| 5 | sl |

Slot 0 spells out the zero case by convention (`"Získať 0 bodov"`) and acts as documentation.
Slots 1.. then follow the language's own classes — sk/cs `[1]`=1, `[2]`=2–4, `[3]`=5+; sl `[2]`=dual,
`[3]`=3–4, `[4]`=5+. For ru and lt, slot 1 also covers 21/101, so it must keep its `{placeholder}`
rather than a literal `1`.

Too few forms is user-visible: the clamp overflows and vue-i18n renders the **whole raw string with
pipes**, e.g. `"Осталось 0 жетонов | Остался 1 жетон | Осталось 5 жетонов"`. It also misrenders the paucal
case (`4 hráčov` instead of `4 hráči`).

Still wrong, all **human** strings on the wiki (left untouched, report upstream): 3 in `ru`, 5 in
`lt`, 5 in `sl`, 1 in `ro` — all `hills-*` and `tile-pack-dialog.*`.

Note: a placeholder-parity check against `en.json` reports false positives on these keys, because
slot 0 legitimately carries a literal `0` where English has none.
