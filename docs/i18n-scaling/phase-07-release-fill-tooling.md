# Phase 7: Release fill worklist tooling and docs

This is Phase 7 of the i18n Scaling feature: Release fill worklist tooling and docs.

## Why this packet exists (shared context)

The whole-packet goal: an English-only PR passes CI, the full 14-locale fill happens
at release time from a cheap per-locale delta, and no silent English ever ships to a
translated player.

Locked decisions carried through every phase:
1. Two-tier CI gate (English-only PRs pass; the release gate requires empty `pending`).
2. A dense generated artifact keeps `tsc` key-safety.
3. Flat dotted-key overlays per locale; `en` stays nested.
4. `t()` behavior: throw-on-untracked in dev; English-for-pending in non-release builds;
   empty-`pending` required at release.

Operational locked decision: worklist generation is automated, but PROSE is
blocked-by-default. Quest narratives, class and ability names, and CJK talent names are
`blocked: human-required` and are never auto-filled. A bot may fill mechanical UI chrome
only. OPEN item carried into this phase: who owns the release fill and the API key (bus
factor). We document the workflow regardless of who that owner turns out to be.

Invariants that bound this phase: `src/sim/` and `server/` stay language-agnostic;
determinism is untouched; no new dependency or framework; the worklist tooling is
DATA-ONLY (no LLM call, no network) and produces the delta a human or a separate model
run consumes; generated files are never hand-edited; this is a shared worktree, so commit
with EXPLICIT paths.

Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.

The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR,
ja_JP, pt_BR, ru_RU.

## State after Phases 1 through 6

- Nested `en` source of truth lives in `src/ui/i18n.en.ts`.
- SPARSE flat overlays are now legal: `src/ui/i18n.locales/<lang>.ts`.
- A dense generated artifact: `src/ui/i18n.resolved.generated.ts` (never hand-edited).
- A registry: `src/ui/i18n.status.json`, carrying `srcHash` and per-key
  `translated` / `pending` / `blocked` states.
- A scanner: `scripts/i18n_scan.mjs`.
- Two-tier CI with an empty-`pending` release gate.

## This phase, in three sentences

Build the cheap, data-only worklist the maintainer runs before a release to fill the
`pending` slice. `scripts/i18n_fill_worklist.mjs` reads the registry's `pending` rows and
emits, one batch per language, a flat per-key delta of `{ key, english, placeholders,
siblings }`, where siblings give translation context. It ships a locked-terms glossary
(project name, the 9 class names, ability names, zone and dungeon proper nouns) so
per-locale terminology does not drift, marks `blocked` (prose) keys so they route to a
human and are never auto-filled, and is a zero-token no-op when re-run on an unchanged
repo (content-hash cached). Then document the full contributor and maintainer workflow.

---

## Implementation starter prompt

Paste the block below into a fresh Claude Code session.

```
This is Phase 7 of the i18n Scaling feature: Release fill worklist tooling and docs.

MODEL: Opus 4.8 (claude-opus-4-8) recommended. Baseline behavior if the identity
line is stale: take small verifiable steps and checkpoint before large changes.
HARNESS: Claude Code. ULTRACODE is NOT required here (one script plus docs). Parallel
Agent fan-out is OPTIONAL and only useful for the independent review pass in STEP 3.

GOAL: Add a data-only release-fill worklist tool (scripts/i18n_fill_worklist.mjs) that
turns the registry's pending slice into a deterministic per-language delta with a
locked-terms glossary, segregates blocked prose to a human-required section, and
document the contributor and maintainer translation workflow.

STEP 0 - PRE-FLIGHT
- Confirm the git working tree is clean for the files you will touch. This is a shared
  worktree; other sessions may be active. Do NOT stash or revert others' work.
- Scan your memory for any prior notes on this feature, the i18n registry shape, and the
  shared-worktree commit policy (stage only your own files with explicit paths).
- Note the current branch. Do not switch branches unless asked.

STEP 1 - LOAD CONTEXT
- Launch one Explore agent. It must summarize, and return findings as text (no files):
  - docs/i18n-scaling/state.md (the cheat sheet) and docs/i18n-scaling/progress.md.
  - This phase file (docs/i18n-scaling/phase-07-release-fill-tooling.md).
  - The registry shape: src/ui/i18n.status.json. Return the exact fields present on a
    row, how pending/blocked/translated are represented, and how srcHash is stored.
  - The scanner scripts/i18n_scan.mjs: how it reads en, how it computes srcHash, how it
    writes pending vs blocked, and the placeholder syntax it recognizes.
  - The flat overlay shape: src/ui/i18n.locales/<lang>.ts (a representative locale).
  - Where contributor and maintainer i18n guidance currently lives: the root CLAUDE.md
    i18n section and src/ui/CLAUDE.md. Return the current documented workflow text so we
    extend rather than duplicate it.
- The agent returns: the registry fields available, the placeholder syntax, the flat
  overlay file structure, and the current documented workflow text.

STEP 2 - CHOOSE ORCHESTRATION AND EXECUTE

  SLICE A - the worklist tool (scripts/i18n_fill_worklist.mjs):
  - Zero dependencies. NO network. NO LLM call. Pure read of i18n.status.json plus the
    nested en source and the locked-terms glossary; pure write of plain data.
  - Select pending keys per target language (all 13 non-en locales, or a --lang filter).
  - Emit a deterministic per-language batch. Each auto-fillable entry is:
    { key, english, placeholders, siblings } where:
      - key: the flat dotted key.
      - english: the resolved English string from nested en.
      - placeholders: the placeholder tokens the string contains (match the scanner's
        syntax exactly so a filled value can be validated).
      - siblings: a few neighboring keys' english values for translation context
        (deterministic selection, e.g. nearest keys sharing the dotted namespace prefix).
  - blocked keys (prose: quest narratives, class/ability names, CJK talent names) go in a
    SEPARATE human-required section per language. They are NEVER placed in the
    auto-fillable batch. A bot consuming the batch must be unable to reach a blocked key.
  - Ship the locked-terms glossary WITH EVERY language batch (project name, the 9 class
    names, ability names, zone and dungeon proper nouns) so terminology does not drift.
    Decide and document where the glossary source lives (a small data file, e.g.
    scripts/i18n_glossary.json, or a const in the script). Prefer a separate data file so
    it is reviewable and editable without touching tool logic.
  - Output is plain data (JSON or markdown) to a known path under a generated directory
    (for example docs/i18n-scaling/worklist/<lang>.json) or to stdout. Ordering MUST be
    stable (sort keys; sort languages) so re-running on an unchanged repo yields
    byte-identical output. Cache on the registry srcHash so an unchanged repo is a
    zero-token no-op (the tool reports "no pending changes" and writes nothing new).
  - Add an "i18n:worklist" script to package.json that runs it.

  SLICE B - docs:
  - Document the CONTRIBUTOR workflow (in src/ui/CLAUDE.md, extending the existing i18n
    guidance, not duplicating root CLAUDE.md): add the key to en ONLY; if the string
    originates in src/sim/ or server/, add a matcher RULE (sim_i18n.ts plus the
    server_i18n.ts mirror) in the SAME change; run npm run i18n:scan; open the PR; it is
    green because the PR-tier gate does not require translations.
  - Document the MAINTAINER release-fill workflow: run npm run i18n:worklist; fill the
    per-language overlays from each batch; NEVER auto-fill blocked prose (route it to a
    human translator); re-run npm run i18n:scan; confirm pending is empty so the release
    gate goes green.
  - Add a short workflow note under docs/i18n-scaling/ (or an RFC appendix) that points to
    both flows and records the OPEN ownership and API-key item explicitly: who runs the
    release fill, who holds the translation API key, and the bus-factor risk. Do not
    resolve it; record it as OPEN with a placeholder owner line.

INVARIANTS - YOU MUST keep these:
  - The tool is DATA-ONLY: no model call, no network, no dynamic import of anything that
    reaches out.
  - Output is DETERMINISTIC (stable ordering, stable sibling selection); re-running on an
    unchanged repo is a no-op.
  - Blocked prose is NEVER placed in the auto-fillable batch.
  - The glossary ships with every batch.
  - No new dependency. Explicit-path commits only.
  - Do not hand-edit generated files; do not touch sim/server language-agnostic code.

OUT OF SCOPE (do not do these here):
  - No LLM integration or auto-translation of prose.
  - No admin migration (that is Phase 8).
  - No pseudo-locale (that is Phase 9).
  - Do not change the gate behavior locked in Phase 6.

STEP 3 - VALIDATION AND REVIEW
  - npx tsc --noEmit
  - Worklist round-trip proof:
      1. Introduce a sample pending key via the scanner (add a key to en, run i18n:scan).
      2. Run npm run i18n:worklist. Confirm the key appears in the correct language batch
         with english + placeholders + siblings, and confirm a blocked key (a prose key)
         is segregated to the human-required section and absent from the auto-fillable
         batch.
      3. Fill the sample key in the overlay(s), re-run i18n:scan, confirm pending shrinks.
      4. Remove the sample key and re-scan so the tree returns to baseline.
  - Re-run npm run i18n:worklist twice on the unchanged repo; confirm byte-identical
    output (deterministic no-op).
  - npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts
    tests/server_i18n.test.ts
  - npm run build
  - Launch parallel review agents (COVERAGE, not filtering: report all findings, do not
    suppress): privacy-security-review, cross-platform-sync. If any agent output is
    truncated, resume it until complete.
  - Do NOT commit while any review verdict is BLOCKING. Fix, re-run, then proceed.

STEP 4 - COMMIT CADENCE (2 to 3 commits, explicit paths only)
  - feat(i18n): add data-only release fill worklist tool
  - feat(i18n): ship locked-terms glossary with the worklist
  - docs(i18n): document contributor and maintainer translation workflow

STEP 5 - ACCEPTANCE (all must hold)
  - i18n_fill_worklist.mjs emits per-language pending deltas with english, placeholders,
    and siblings, plus the glossary in every batch.
  - blocked prose is segregated to a human-required section and cannot reach the
    auto-fillable batch.
  - The tool is deterministic and a no-op on an unchanged repo.
  - Contributor and maintainer workflows are documented.
  - The OPEN ownership and API-key item is recorded.
  - tsc, the named test files, and the build are all green.

STEP 6 - DOC UPDATES
  - docs/i18n-scaling/progress.md: add the Phase 7 checklist with each acceptance item.
  - docs/i18n-scaling/state.md: add an additions-log row 7 recording the new script
    (i18n:worklist), the glossary location, and mark the blocked-surface list FINALIZED.
    Keep the ownership and API-key item OPEN.

STEP 7 - FINAL RESPONSE FORMAT
  Report: status; files changed (absolute paths); validation results (tsc, round-trip,
  no-op proof, named tests, build); review verdicts; deferrals including the OPEN
  ownership item; and an explicit handoff to Phase 7 QA.

STOPPING RULES
  - Stop and report if the worklist cannot be made deterministic.
  - Stop and report if a blocked prose key could leak into the auto-fillable batch.
```
