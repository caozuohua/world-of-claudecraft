# 16 QA: the fills hold, and the packet closes

STATUS: NOT STARTED

Read `docs/achievements/overview.md` first (authoritative), then the 16
implement file and its progress.md row. This is the FINAL session of the
polish round: it verifies the translation fill, runs the whole-feature
closing sweep, and executes the packet cleanup decision as its exit step.
House rules: no em/en dashes or emojis in anything you WRITE this session
(translated corpus conventions are exempt per the 16 spec); no
"phase"/packet wording in anything that ships.

## 0. Orient

Read the 16 session summary, the per-family reviewer verdicts, and the diff
shape (overlays, deed_i18n, glossary, generated artifacts, baseline).

## 1. Re-run acceptance (all of it, from a clean tree)

Every command in the 16 Acceptance section verbatim, real exit codes,
`npm run gate` UNPIPED.

## 2. Fill integrity audit (the load-bearing check)

- Deeds-owned pending rows: zero in all locales (fresh worklist run).
- Placeholder integrity across the WHOLE fill: script a token check (every
  {token} in each English value appears exactly once in each locale value,
  and no locale value introduces a token English lacks). Zero exceptions.
- Coverage manifest full for every locale; sample 10 deed ids per script
  family and eyeball name/desc/title presence and plausibility.
- The five Zenzie re-fills correct (native readers unavailable; verify the
  old transliteration is GONE and the new value contains the locale's
  Zenzie form).
- Non-deeds pending rows unchanged in count AND content vs the round base,
  PLUS exactly the 60 release-owned rows the post-fill v0.24.0 merge
  ee0d8ab5c brought in (hudChrome.readyCheck.{prompt,ready,notReady,result}
  x 15 locales, PR #1716): expected non-deeds total 681 = 621 + 60,
  deeds-owned still zero.
- Same-commit discipline: the commit graph shows regen + sha256 baseline
  inside the fill commits, never trailing.

## 3. Browser verification

Beyond the 16 matrix (ja/de/ru), run TWO more locales (pick zh_TW and pl_PL)
through the Book, tracker, titled chat, wiki page, Renown tab. Then the
regression direction: en still renders everything (a fill typo can shadow
the base); switch locales live with the Book OPEN (the language-switch
rebuild path must not throw).

## 4. Whole-round closing sweep (the feature is DONE after this)

- `npm run gate` UNPIPED on the final tree, recorded.
- The full offline walkthrough once more at 1600x900 and 844x390: window,
  icons, titles pane, unlock moment, tracker, chroniclers (Zenzie by name),
  titled chat, player card.
- Confirm every maintainer flag accumulated in progress.md rows 9 to 16 is
  itemized in ONE "flags for the maintainer" list in this row's notes (icon
  brief for new deeds, deferred surfaces, remaining non-deeds pending count,
  anything else the rounds recorded).

## 5. Reviewer dispatch

- qa-checklist over the whole polish round (rows 9 to 16 diffs union) at
  whole-feature depth.
- test-coverage-auditor if any test changed since its last pass.

## 6. Adversarial what-is-missing pass

- Grep the tree for any leftover English in a non-en overlay deeds section.
- Any surface added in 09 to 15 whose key was born AFTER the 16 worklist
  pull (the classic gap: verify the final worklist run post-dates the last
  code commit)? Note: the v0.24.0 merge ee0d8ab5c post-dates the 16
  worklist pull by design; the fresh run in step 2 surfaces exactly the 60
  release-owned hudChrome.readyCheck rows, which are upstream release-fill
  territory, not 09 to 15 stragglers.
- Does anything in the round contradict overview decisions 1 to 9? (Walk
  them one by one; decision 8 is retired by design this round.)

## Exit step: packet cleanup (execute LAST, after everything above is green)

The maintainer's standing instruction: keep what helps future AI sessions,
delete what does not. The locked decision for this round:

- KEEP: `overview.md` (canonical names + decisions), `catalog/` (the living
  authoring source of truth, including new-deeds-icon-brief.md until the
  maintainer commissions the art), `progress.md` (the dense history),
  `screenshots/` (the evidence set).
- DELETE: `phase-09-*.md` through `phase-16-*.md` (sixteen files; their
  knowledge lives in progress.md notes and the durable docs/design/deeds.md;
  git history preserves the specs).
- Before deleting, update progress.md rows 16 and 16Q and the footer so the
  table is complete and self-explanatory WITHOUT the files it references.
- Commit the deletion as `chore(docs): remove internal working notes` with
  explicit paths (the same shape the first round used).

## Exit criteria

Acceptance green from clean tree, fill integrity clean, browser passes
recorded, the closing sweep green, the maintainer flag list written, the
cleanup commit landed, progress.md rows 16 and 16Q final.

## End of session

The polish round is complete. Name no next file; the final message reports
the feature state, the maintainer flag list, and the remaining non-deeds
pending count, and reminds that the branch stays LOCAL ONLY until the
maintainer calls for the PR.
