---
name: add-language
description: Add a new language to the game. Use when adding a locale, translating the UI, or adding a script that needs its own font stack.
---

# Adding a language

The whole translatable surface is ~60 UI strings — the canvas contains no words at all.
See `.claude/rules/i18n.md` for how the build and URL layout work.

1. **Add an entry to `LOCALES`** in `src/i18n/locales.js` — `code`, `path`, `htmlLang`,
   `ogLocale`, `name` (written *in that language* — "Deutsch", never "German"), and `match`
   (the browser codes that should route there, generously). Set `latinExt: true` if the
   alphabet needs it.
2. **Copy `src/i18n/messages/en.js`** to `src/i18n/messages/<code>.js` and translate. Keep
   every key; keep `{placeholders}` intact.
3. **Run `npm run check:i18n`.** It fails on missing keys, unknown keys, missing plural
   categories for that language, and unknown placeholders.
4. **Run `npm run build`** — `_redirects`, `sitemap.xml`, the `hreflang` cluster and the
   switcher all pick the new language up automatically.

## A language in a script with no font stack yet

Cyrillic, Greek and Vietnamese need a fifth step, **before** the rest: add a `--font-ui`
override to the "Locale font stacks" block at the top of `style.css`, keyed off the new
`htmlLang`.

Inter ships `cyrillic` and `greek` subsets, so those two could be `@font-face` declarations
rather than a system stack — but check the line-breaking rules for the script either way:

- **Japanese and Chinese** break between characters, so they only need `line-break: strict`.
- **Korean** uses spaces between words, but browsers apply CJK breaking to it and will split
  a word across lines. It needs `word-break: keep-all` instead.

CJK and Hangul are already covered, and use the reader's **system font** — a subsetted
Noto Sans JP is several megabytes, more than the rest of the game put together.

## Things that are easy to get wrong

- **Ordering in `LOCALES` is load-bearing for Chinese.** `zh-Hant` must stay listed before
  `zh-Hans` so its redirect rule is emitted first: Netlify applies the first match, and the
  bare `zh` in the Simplified rule would otherwise catch `zh-TW`. Moving the entries would
  silently serve Simplified to Taiwan and Hong Kong.
- **Do not translate**: the "Loopy" wordmark; difficulty keys (`easy`/`medium`/`hard`) in
  URLs, storage, seeds and analytics; the tutorial section `name` values in
  `tutorialSheet.js`, which are analytics labels and must stay stable across languages.
- **Japanese and Korean force a politeness-register choice** (ですます vs plain; 해요체 vs
  합니다체) that a non-native pass gets wrong in a way that reads as machine translation
  rather than as a typo. The shipped copy is deliberately informal-polite in both. A native
  review is cheap at ~60 strings and worth doing before promoting a language.
- **`npm run dev` serves one language.** Use `LOCALE=de npm run dev`; the locale paths
  (`/de/`) only exist in a real build, so the switcher's targets 404 in dev.
