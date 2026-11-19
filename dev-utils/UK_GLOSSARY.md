# Ukrainian (uk) terminology — from the official rulebooks

Source: the nine official Ukrainian rulebooks supplied 2026-11-04 (base game + expansions 1–6, 9, 10).
Extracted text layer, not OCR, so the spellings below are the publisher's own.

Use this as the authority when translating `JCloisterZoneLocale/uk`. Where the books give a term,
it wins over anything more literal.

## Core

| English | Ukrainian | note |
|---|---|---|
| tile | **плитка** (плитка місцевості) | "land tile"; plural плитки |
| start tile | **початкова плитка** | |
| meeple / follower | **підданець** (pl. підданці) | the books' own word; фігурка = the wooden piece |
| city | **місто** | |
| road | **дорога** | |
| monastery / cloister | **монастир** | |
| field / farm | **поле** (pl. поля) | |
| points | **очки** | |
| scoreboard | **планшет підрахунку очок** | |
| supply | **запас** | |
| turn | **хід** | |
| player | **гравець** | |
| expansion | **доповнення** | |
| game | «**Каркасон**» | the title takes guillemets in Ukrainian |

Follower roles, which the base book names explicitly: road = **мандрівник**, city = **лицар**,
monastery = **чернець**, field = **селян** / **фермер**.

## Figures and features

| English | Ukrainian | note |
|---|---|---|
| abbot | **абат** | |
| big follower | — | not in these books |
| builder | **будівельник** | |
| pig | **свиня** | |
| inn | **таверна** | |
| cathedral | **собор** | |
| dragon | **дракон** | |
| fairy | **фея** | |
| magic portal | **портал** | |
| spring (dragon's start) | **джерело** | C2/C3 replacement for the volcano |
| tower | **вежа** | tower floors = яруси веж |
| thief | **злодій** | |
| watchman | **вартовий** | |
| mayor | **мер** | |
| wagon | **віз** | |
| shepherd | **пастух** | |
| sheep | **вівця** (pl. вівці) | |
| vineyard | **виноградник** | |
| wolf | **вовк** | |
| goose | **гуска** (гуси) | |
| circus | **цирк** | |
| ringmaster | **директорка цирку** | the books use the feminine form |
| acrobats | **акробати** | human pyramid = піраміда |
| shield | **щит** | |
| tournament | **турнір** | |

## Official expansion titles

| # | Ukrainian | English |
|---|---|---|
| 1 | Таверни та собори | Inns & Cathedrals |
| 2 | Торговці та будівельники | Traders & Builders |
| 3 | Дракон і фея | The Princess & The Dragon |
| 4 | Вежі та злодії | The Tower |
| 5 | Посланці та мери | (reworked Abbey & Mayor) |
| 6 | Турніри та щити | (reworked Count, King & Robber) |
| 9 | Пастухи та вівці | Hills & Sheep |
| 10 | Цирк та артисти | Under The Big Top |

## Where the books and jCloisterZone disagree

These are editions newer than the ones jCloisterZone models, so a few elements do not line up.
Flagging them rather than guessing:

- **Trade goods.** The books use **кури** (chickens), **пшениця** (wheat), **тканина** (cloth).
  jCloisterZone models wine / grain / cloth. `тканина` and `пшениця` map fine; for `wine` the
  books offer no term, because this edition's art replaced it with chickens. Literal **вино** is
  probably the right call for the app, but it is a choice, not a quotation.
- **Expansion 5.** The Ukrainian edition ships **ратуша** (town hall), **мер**, **посланець**
  (messenger), **опудало** (scarecrow) and **віз**. jCloisterZone's Abbey & Mayor wants
  abbey / mayor / wagon / barn — so `mayor` and `wagon` are covered, but **abbey** and **barn**
  have no official term here (абатство / клуня would be the standard words).
- **Princess.** Absent: expansion 3 is titled *Дракон і фея*, with no princess component. For
  `game.element.princess`, принцеса is the normal Ukrainian word but is not from the books.
- **Expansion 6** is *Турніри та щити*, not Count/King/Robber, so king, robber and the Count have
  no official term in this set.

## Plural forms

Ukrainian needs **4** pipe-separated forms in a locale string (`nplurals + 1`, slot 0 unused —
same family as `ru`), per `src/renderer/plugins/vuei18n.js`. A `uk` entry must be added to
`getPluralCode` there; it does not exist yet. Use the Russian formula:

```js
case 'uk':
  nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
  break;
```

Slots then are `[0]` zero text, `[1]` 1/21/101 (**очко**), `[2]` 2–4 (**очка**), `[3]` 5+ (**очок**),
and slot 1 must keep its `{placeholder}` rather than a literal 1.
