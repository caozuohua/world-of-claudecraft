# 15: The wiki tells the whole deeds story, spoiler-safe

STATUS: NOT STARTED

Read `docs/achievements/overview.md` FIRST (sections 2, 3, and 5 verbatim),
then `src/guide/CLAUDE.md` in full (the generator model, the spoiler policy,
the new-page recipe), then the 06 row in progress.md (the session that built
the deeds page and its locked judgments: no desc, no trigger, structural
hidden filtering, no per-deed search indexing).

Reminder that binds every step: no "phase"/packet wording, em/en dashes, or
emojis in anything that ships. English-only i18n via the pending mechanism;
any new WORDY `guide.*` key needs its five non-Latin fills in the same change
(M16). This is the LAST session allowed to touch English guide prose: the
translation fill (16) freezes against this session's output.

## Goal

The deeds wiki page was built in session 06 against the 186-deed catalog.
Since then the feature gained six 09 deeds plus anything session 14 added,
real icon art, titles on seven surfaces, renamed and re-dressed chroniclers,
and a Renown leaderboard; five release merges also reshaped adjacent guide
content. This session audits every deeds-related wiki surface against the
FINAL catalog and feature set, closes real gaps, records deliberate
omissions, and re-proves spoiler safety end to end, so the wiki is fully
current before English freezes for translations.

## Context to load before writing anything

- `scripts/wiki/build_content.mjs` (the GUIDE_DEEDS emitter and its field
  allowlist), `src/guide/pages/deeds.ts`, the guide route registry and
  sitemap, `tests/guide.test.ts` (freshness + the spoiler pins).
- `src/sim/content/deeds.ts` on the CURRENT tree (the live set after 14).
- `docs/design/deeds.md` (the shipped design doc: the wiki and this doc must
  state the same rules with the same vocabulary; 13Q verified this once, the
  14 round may have moved either side).
- The 06 locked judgments in progress.md rows 6 and 6Q, which this session
  inherits unless it records a reasoned change: criteria stay in-game (no
  desc, no trigger), hidden deeds structurally absent, chronicler names never
  baked, no per-deed search indexing, the three boss-epithet name echoes
  accepted by design.

## The audit matrix (verify each, fix or record a judgment)

1. Set equality: /wiki/deeds rows equal the live public catalog exactly
   (every non-hidden id present, hidden ids absent, name/category/renown/
   reward columns correct); scripted comparison against the executed sim
   module, not eyeballing.
2. Freshness: `npm run wiki:content` diffless on the committed tree; the
   guide test suite green.
3. Spoiler safety re-proven from scratch: enumerate hidden defs from the sim
   source and grep the generated artifact, the rendered DOM, and the built
   entry chunks for ids, names, and descs; verify no trigger or desc text is
   emitted for ANY deed; re-inspect the boss-epithet echo list for new
   entries the 09 and 14 additions may have introduced.
4. Feature currency of the page prose: does the page reflect what shipped in
   the polish round where a spoiler-safe reader would expect it: that deeds
   carry icon art, that titles display in chat/nameplate/boards, that a
   lifetime Renown leaderboard exists, the Book keybind, the watch tracker?
   For each: add a sentence at marketing altitude, or record why the omission
   is right (in-game discovery beats wiki completeness). Never bake exact
   totals that content patches would stale (counts derive from the generator,
   prose does not repeat them).
5. Chronicles and Chroniclers: the page's Chronicle treatment matches the
   final three-zone reality; chronicler NAMES stay out of the baked content
   (re-verify; the 12 rename made this a live hazard).
6. Cross-page sweep: grep the whole guide (pages, generated content, nav,
   sitemap) for deeds mentions; every mention is accurate against the final
   feature; decide deliberately whether zone/dungeon/profession pages should
   cross-link the deeds page, and record the judgment either way (the 06
   precedent: no per-deed listings on other pages).
7. Consistency: the wiki page, `docs/design/deeds.md`, and README speak the
   same vocabulary (Deed, Renown, Chronicle, Feat, Title, Border) with no
   contradicting numbers or rules.
8. Routes, nav, sitemap, and the route-derived search entry still resolve;
   /wiki/deeds renders clean on desktop and portrait phone in the guide's
   fixed dark design with zero console errors beyond the known
   backend-absent noise.

## Out of scope

- Translations (session 16 owns every non-English string).
- Catalog or sim changes of any kind (if the audit exposes a content defect,
  flag it for the maintainer or a follow-up; this session ships guide-layer
  changes only).
- Guide surfaces with no deeds relationship.

## Steps

1. Pre-work: merge the latest origin/release/v0.24.0 per the standing rule
   (release-merge-audit, regen discipline).
2. Run the audit matrix; collect gaps and judgments.
3. Land the guide-layer fixes (generator, page prose, routes) with tests
   where the guide suite has a pattern for them; M16 fills for any new wordy
   keys in the same change; regen + sha256 re-baseline same commit if
   catalog keys moved.
4. Browser verification pass (desktop + portrait phone) on the committed
   tree.
5. Biome on touched files; targeted vitest; `npm run gate` UNPIPED.
6. Update `docs/achievements/progress.md` row 15; commit with explicit
   paths, scope `guide` (or `docs` where the change is prose-only).

## Acceptance (all must pass)

- `npx vitest run tests/guide.test.ts tests/architecture.test.ts tests/localization_fixes.test.ts`
- `npm run wiki:content` diffless on the committed tree.
- The scripted set-equality comparison passes (public = non-hidden live set,
  exactly).
- The spoiler greps return zero hits for every hidden id, name, and desc, and
  zero trigger text for any deed, across generated content, DOM, and built
  chunks.
- Browser pass recorded: /wiki/deeds desktop + portrait phone, zero errors.
- `npm run gate` UNPIPED, exit 0.

## Reviewer dispatch (fresh agents, never the implementer)

- qa-checklist over the diff (guide invariants, i18n scope, copy hygiene).
- A fresh spoiler auditor: hand-enumerate the hidden set from sim source and
  hunt it through every generated and built artifact, independent of the
  implementer's greps.

## Adversarial pass (answer each in the session summary)

1. Would a wiki reader learn anything an in-game player is meant to discover
   (hidden deeds, encounter mechanics, trigger details, reveal notes)?
2. Is any statement on the page stale against the final catalog or feature
   set, and would the next content patch stale anything you added?
3. Do the wiki, docs/design/deeds.md, and README disagree on any number or
   rule?
4. Did every judgment call (omission kept, cross-link declined) get written
   into the row so 16 and future contributors inherit it?

## End of session

Update `docs/achievements/progress.md` row 15. Name the next file:
`docs/achievements/phase-15-qa.md`.
