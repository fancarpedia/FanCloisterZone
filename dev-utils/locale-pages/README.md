# Saved locale pages

Put wiki pages saved from the browser here, one file per language:

```
dev-utils/locale-pages/en.txt
dev-utils/locale-pages/cs.txt
dev-utils/locale-pages/sk.txt
...
```

`node dev-utils/update-locales-download.js --print-urls` prints the URL to open for each
language and the filename to save it as. `.txt`, `.wiki` and `.wikitext` are all accepted.

Save the **raw wikitext** — the `?action=raw` URL — not the rendered article. The raw page starts
with wiki markup and contains a `== Locale file ==` heading; a saved rendered page does not and
will be rejected.

These files are the *input*. `update-locales-download.js` reads them and writes the locale block,
with the `<span>` markers for untranslated/outdated strings still in place, to
`dev-utils/locale-raw/<code>.raw.json`.

Everything in this folder except this README is gitignored: it is scratch, and the pages can be
re-saved at any time.

## Why pages are saved by hand

wikicarpedia.com sits behind an Anubis bot challenge that answers every automated request —
`?action=raw`, `api.php`, `Special:Export`, the REST API — with HTTP 200 and an HTML challenge
page. A browser passes it transparently, a script cannot. If the wiki operator allowlists
`?action=raw` for this page, the script downloads directly again and this folder stops being
necessary.
