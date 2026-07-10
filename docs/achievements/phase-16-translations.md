# 16: Every deeds string in every supported language

STATUS: NOT STARTED

Read `docs/achievements/overview.md` FIRST. This session RETIRES overview
decision 8 (English-only during the build): the feature's English is now
frozen, and the maintainer has delegated the full release fill for the deeds
feature to this session. This is the ONE session of the packet allowed to
edit `src/ui/i18n.locales/` overlays and `DEED_LOCALES`.

Reminder: no em/en dashes or emojis in code, keys, or ENGLISH copy; for
TRANSLATED copy, match each locale's existing corpus conventions (the ru
corpus legitimately uses dashes where Russian grammar requires them; NEVER
strip or avoid them there; read the copy-scan exemptions before assuming the
scan cares). No "phase"/packet wording in anything that ships.

## Goal

Every player-visible string the deeds feature owns renders natively in all
21 locales (22 languages counting en): the HUD chrome, the wiki page prose,
the chronicler NPCs (including the Zenzie fix for the five stale non-Latin
fills), the API errors, the Steam card, every key added by sessions 09 to
13, and the full deed catalog itself (name, desc, and title per deed) via
DEED_LOCALES. Deeds-scoped pending rows reach ZERO; non-deeds pending rows
are untouched (they belong to other features' release fills; report the
remaining count to the maintainer).

## Scope (fill exactly this; verify counts live before starting)

From the last audit (recount with `npm run i18n:worklist` first; sessions 09
to 13 added keys):

1. `hudChrome.deeds.*` (~60 keys) and `hudChrome.mobile.deeds`.
2. `guide.deedsPage.*` + `guide.nav.deeds` (~32 keys).
3. `entities.npcs.chronicler_*` (9 keys x locales), INCLUDING re-filling the
   five non-Latin overlays where the Zenzie rename left stale
   transliterations of the old name (ja_JP, ko_KR, ru_RU, zh_CN, zh_TW).
4. `apiError.deeds.*`.
5. `hudChrome.steam.*` (the deeds-feature Steam card keys; the five
   non-Latin wordy fills exist, the Latin locales are pending).
6. Every key sessions 09 to 15 added (the chat titled-name pattern key, any
   new guide prose, any new chrome): pull the live list from the worklist,
   never from this file.
7. `DEED_LOCALES` in `src/ui/deed_i18n.ts`: per locale, a table keyed by
   deed id with `name`, `desc`, and (where the deed rewards one) `title`,
   for the FULL catalog including the 09 and 14 additions. This is the big block
   (~190+ deeds x 3 fields x 21 locales) and it is INVISIBLE to the pending
   counter; the deed_i18n coverage manifest is the completeness oracle.

NOT in scope: every pending row whose key is not deeds-owned. Zero edits to
sim_i18n/server_i18n dictionaries (audited: no sim/server-emitted deed
English exists; re-verify with a grep before trusting it).

## Context to load before writing

- `docs/i18n-scaling/translation-workflow.md` in full (the fill mechanics,
  the release-tier gate semantics, the reword-staleness rule).
- `src/ui/deed_i18n.ts` (the DEED_LOCALES shape and its coverage manifest)
  and `src/ui/talent_i18n.ts` plus its newlocales pattern (the per-locale
  entity-table precedent to copy).
- `scripts/i18n_glossary.json`: the per-locale glossary. EXTEND it first
  with the deeds system terms (Deed, Book of Deeds, Renown, Chronicle,
  Chronicler, Feat, Title, Border, plus the 19+ reward titles) so every
  locale's fill uses one consistent vocabulary; classic-MMO register per
  locale (the terms a player of localized classic-era MMOs would expect),
  and the locked terms already in the glossary from the M16 fills of
  sessions 03 to 07 stay AS IS: the new fills must agree with them.
- The five non-Latin overlays' existing deeds sections (the M16 fills):
  they are the quality bar and the vocabulary anchor for those locales.
- One Latin overlay end to end (pick de_DE) to absorb the file conventions
  (key order, comment style, escaping).

## Mechanics (the order matters)

1. Recount: `npm run i18n:worklist`; extract the deeds-owned rows per
   locale; record the starting numbers in the session summary.
2. Reword-staleness sweep FIRST: diff the resolved en table at this round's
   base sha vs HEAD for keys that existed before with changed English
   values; any such key with live translations gets re-filled this session
   even if not marked pending.
3. Glossary extension commit.
4. The overlay fills: fan out per locale (one worker per locale, the
   glossary and the non-Latin anchor sections in each prompt; workers write
   ONLY their own locale file). Translate MEANING in the locale's classic
   register, never transliterate English game terms unless the locale's
   corpus already does. Proper nouns: follow each locale's existing
   treatment of NPC names (the existing chronicler fills show it) and keep
   Zenzie as Zenzie (transliterated where the script demands).
5. `DEED_LOCALES`: same fan-out, per-locale tables in deed_i18n.ts (or its
   newlocales sibling if the talent precedent splits files; follow the
   precedent exactly). Deed names are creative titles: translate in-register
   (the existing localized-MMO feel), keep hidden-deed reveal notes safe,
   never leak trigger info the English desc withholds.
6. Regenerate: `npm run i18n:gen`, then the sha256 re-baseline
   (`node scripts/i18n_resolved_hash.mjs --write`) in the SAME commit as
   the fills; status artifacts committed.
7. The TODO guard: check the guard's semantics before writing any value
   that contains a bare "todo" in es/pt (a real word there); the guard has
   a known false-positive shape.

## Out of scope

- Non-deeds pending rows (report the remaining total instead).
- Any English rewording (English froze at 15; if a fill exposes a bad
  English source string, flag it, do not fix it here).
- Admin dashboard keys unless a deeds key exists there (audit says none;
  verify).

## Steps

1. Recount + staleness sweep + glossary commit.
2. Locale fan-out (overlays), commit per coherent batch with explicit
   paths, scope `i18n`.
3. DEED_LOCALES fan-out, same discipline.
4. Regen + re-baseline same commit; equivalence test green.
5. Verification matrix below; biome on touched files; `npm run gate`
   UNPIPED.
6. Update progress.md row 16; commit.

## Acceptance (all must pass)

- `npm run i18n:worklist` shows ZERO deeds-owned pending rows in every
  locale (grep the worklist JSONs; record the remaining non-deeds count).
- The deed_i18n coverage manifest reports full coverage for every locale
  (name/desc/title per deed).
- `npx vitest run tests/i18n_resolved_equivalence.test.ts tests/deed_i18n.test.ts tests/localization_fixes.test.ts`
- `npx vitest run tests/guide.test.ts tests/architecture.test.ts`
- Browser round-trip in ja_JP, de_DE, ru_RU: the Book (cards, chips,
  titles pane), the tracker, a titled chat line, /wiki/deeds, the Renown
  tab; zero English fallbacks visible, zero raw keys, zero empty strings.
- `git grep -n 'Edda Hartwell' -- src/ui/i18n.locales` returns zero hits.
- `npm run gate` UNPIPED, exit 0.

## Reviewer dispatch (fresh agents, never the implementer)

- qa-checklist over the diff shape (same-commit regen + baseline, no
  English left in overlays, no non-deeds rows touched).
- Per-family spot review: one fresh agent per script family (CJK, Cyrillic,
  Latin) samples 20 strings each against the glossary and the English
  source for meaning drift, register, and placeholder integrity
  ({name}, {title}, {count} tokens preserved exactly).

## Adversarial pass (answer each in the session summary)

1. Do any two locales disagree on the translation of Renown or Deed within
   themselves (grep each locale for both terms across all its deeds keys)?
2. Did any fill break a placeholder or add a stray brace?
3. Is the pending count for NON-deeds keys byte-identical before and after
   (prove no collateral edits)?
4. Does a release-tier build of JUST the deeds surfaces throw anywhere
   (spot: t() of five deeds keys per locale in a scratch node run)?
5. Which strings were hardest and what judgment did you apply (record the
   three most debatable calls per family)?

## End of session

Update progress.md row 16. Name the next file:
`docs/achievements/phase-16-qa.md`.
