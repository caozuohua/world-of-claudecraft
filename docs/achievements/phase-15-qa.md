# 15 QA: the wiki audit holds, and English is ready to freeze

STATUS: NOT STARTED

Read `docs/achievements/overview.md` first (authoritative), then the 15
implement file and its progress.md row. This QA gate matters doubly: session
16 translates whatever English this session leaves behind, so a stale or
leaky wiki line becomes 21 stale translations. House rules: no em/en dashes
or emojis anywhere; no "phase"/packet wording in anything that ships;
English-only i18n, pending rows expected.

## 0. Orient

Read the 15 session summary, its recorded judgments, and the guide-layer
diff since the 14Q closing sha.

## 1. Re-run acceptance (all of it, from a clean tree)

Every command in the 15 Acceptance section verbatim, real exit codes,
`npm run gate` UNPIPED.

## 2. Independent spoiler and set-equality audit (the load-bearing check)

- Re-derive the hidden set and the public set from the sim source yourself
  and re-run the equality and leak checks with your own scripts, not the 15
  session's; generated content, rendered DOM, and built chunks all covered.
- Mutation-check the structural filter once: blank it, regenerate, confirm
  the guard tests red, restore byte-clean (never git checkout over
  uncommitted work).
- Verify the boss-epithet echo judgment list is current for the full live
  catalog.

## 3. Currency and consistency verification

- Walk the 15 audit matrix yourself at spot-check depth: five random public
  deeds present and correctly rowed, the feature-currency prose claims true
  against the code (keybind, titles surfaces, leaderboard, icon art), the
  vocabulary consistent across wiki, docs/design/deeds.md, and README.
- Every judgment the 15 row records (omissions kept, cross-links declined)
  actually matches what shipped; a judgment that says "omitted" whose
  surface exists anyway is a finding, and vice versa.
- Fresh-eyes routing: from src/guide/CLAUDE.md alone, would a contributor
  adding a new zone page know the deeds page exists and how deeds reach the
  wiki? If the trail breaks, fix the doc now.

## 4. Browser re-verification

Independent pass on the committed tree: /wiki/deeds desktop and portrait
phone, the deep-path cold load AND the SPA sidebar navigation, dark design
integrity, zero console errors beyond the known backend-absent noise.

## 5. i18n readiness for the freeze

- Any new wordy guide.* key carries its five non-Latin fills in the same
  commit (M16); non-wordy additions sit English-pending by design.
- If any catalog English key moved, the sha256 baseline moved in the SAME
  commit (commit graph, not working tree).
- Produce the 16 handoff line: the count of deeds-owned pending rows as of
  this tree, so the translation session starts from a verified number.

## 6. Reviewer dispatch

Read the 15 verdicts and resolve anything open; dispatch a fresh
qa-checklist if 15 amended after its own dispatch.

## 7. Adversarial what-is-missing pass

- Did the 15 pre-work merge (or any merge since) add content the wiki bakes
  that the audit range missed?
- Is there any deeds-related English OUTSIDE the guide and catalog that 16
  will need and nobody inventoried (a toast, an error, a Steam string added
  during the polish round)? Cross-check the worklist.
- Does anything in the diff contain a dash, emoji, or packet vocabulary?

## Exit criteria

Acceptance green from a clean tree, the independent spoiler and equality
audits clean, the filter mutation redded and restored, browser passes
recorded, the 16 handoff number written, progress.md row 15Q done.

## End of session

Update progress.md row 15Q. Name the next file:
`docs/achievements/phase-16-translations.md`.
