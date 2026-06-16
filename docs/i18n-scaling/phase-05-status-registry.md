# Phase 5: Status registry and content-hash scanner

This is one of two planning documents for Phase 5 of the i18n Scaling feature.
This file is the implementation prompt. Its sibling is `phase-05-qa.md`. Paste
the fenced block below into a fresh Claude Code session to run the phase.

## Where this sits in the whole packet

The i18n Scaling feature ships in phases. The whole-packet goal: an
English-only PR passes CI on its own, the full 14-locale fill lands by release,
and no translated player ever silently sees English. Four locked decisions
hold across every phase:

1. A two-tier CI gate (English-correctness always; full-locale only at the
   release tier).
2. A dense generated artifact typed `: typeof en` so `tsc` keeps catching
   missing or renamed keys.
3. Flat dotted-key overlays for the 13 non-English locales, with `en` itself
   authored nested.
4. A `t()` that throws on an untracked key in dev and serves English for a
   pending, non-release key.

Invariants that bind every phase: `src/sim/` and `server/` stay
language-agnostic (no `t()`, no DOM); determinism is untouched; no new
dependency or framework is introduced; generated files are never hand-edited
(they carry a do-not-edit banner and must be reproducible, the same discipline
as the media manifest); the worktree is shared with other sessions, so all
commits are made with explicit file paths, never `git add -A` or `git add .`.

The running cheat sheet lives at `docs/i18n-scaling/state.md` and the phase
checklist at `docs/i18n-scaling/progress.md`. A byte-equivalence net is already
in place: the resolved translation table must stay byte-identical across a
refactor unless a phase deliberately changes it.

## What exists after Phases 1 through 4

- `en` is authored nested in `src/ui/i18n.en.ts`.
- The 13 non-English locales are flat dotted-key overlays in
  `src/ui/i18n.locales/<lang>.ts`. The three dialects (`es_ES`, `fr_CA`,
  `en_CA`) are divergence-only over their base locale but still resolve dense
  overall.
- `scripts/i18n_build.mjs` emits the dense generated artifact (the one typed
  `: typeof en`).
- Two matchers re-localize player text emitted by the language-agnostic core:
  `src/ui/sim_i18n.ts` (EXACT entries plus roughly 28 RULES) and
  `src/ui/server_i18n.ts` (EXACT plus roughly 37 RULES). Each carries its own
  per-locale DICTs.
- `src/admin/i18n.ts` is a separate flat DICT, about 181 keys across 14
  locales.
- `tests/localization_fixes.test.ts` hand-maintains two literal Sets:
  `COPIED_ALLOW` (around 43 entries, the cognate whitelist where a translation
  legitimately equals the English) and `ALLOW_V07_SLASH` (around 105 entries,
  the slash-command surface still pending localization).

## What Phase 5 introduces

A generated status registry, `src/ui/i18n.status.json`, that records the state
of each key per locale:

- `translated`: the locale has a real translation. The row stores a `srcHash`
  (a hash of the English source text plus its sorted placeholder set) and a
  `by` field (`human` or `agent`).
- `pending`: untranslated, or stale because the English source changed since
  the translation was recorded (the stored `srcHash` no longer matches the
  current English `enHash`).
- `blocked`: a deliberate English backstop, carrying a required human-written
  `reason`.

A scanner, `scripts/i18n_scan.mjs`, builds this registry with no LLM and no
network. It walks the full key universe (`en` leaves plus matcher keys plus
admin DICT keys), diffs each locale overlay and DICT against the stored hashes,
and rewrites `i18n.status.json` deterministically.

The hand-maintained `COPIED_ALLOW` and `ALLOW_V07_SLASH` Sets become generated
VIEWS over the registry rather than literal Sets in the test file.

Because everything is still dense after Phase 4, the `pending` set is empty at
the end of this phase. Real sparseness (genuine pending keys) arrives in
Phase 6. Phase 5 is a batchy hashing sweep across thousands of key-and-locale
pairs, which makes it a Workflow candidate.

## Implementation starter prompt

```text
This is Phase 5 of the i18n Scaling feature: Status registry and content-hash scanner.

MODEL: Opus 4.8 (claude-opus-4-8).
HARNESS: Claude Code, autonomous multi-step. Build and tests must stay green at
each checkpoint.
ULTRACODE: add `ultracode`. Hashing every en, matcher, and admin key across 14
locales and assembling the registry is a uniform batch over thousands of
entries. Orchestrate it as a Workflow: a pipeline whose stages are
hash -> classify -> emit registry row, then verify counts at the end. Do not
hand-spawn one agent per locale. Cap manual fan-out at about 5 agents for the
parts that do not fit the pipeline (context loading, review).

GOAL: Add a no-LLM, no-network status scanner that generates a reproducible
per-key per-locale registry, and turn the two hand-maintained allow-list Sets
into generated views over that registry, all while everything stays dense so
the pending set is empty.

STEP 0 - PRE-FLIGHT
- Confirm the git worktree is clean (this tree is shared with other sessions;
  do not touch files you did not change). If dirty with someone else's work,
  stop and report.
- Scan memory for prior decisions on this feature before starting.

STEP 1 - LOAD CONTEXT
Spawn one Explore agent. Have it summarize:
- docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md.
- This phase file (phase-05-status-registry.md).
- The build script scripts/i18n_build.mjs and the overlay file shape in
  src/ui/i18n.locales/<lang>.ts (flat dotted keys).
- The matcher DICT shapes in src/ui/sim_i18n.ts and src/ui/server_i18n.ts
  (EXACT plus RULES, per-locale DICTs).
- The admin DICT shape in src/admin/i18n.ts (flat, ~181 keys x 14).
- The current COPIED_ALLOW and ALLOW_V07_SLASH Sets in
  tests/localization_fixes.test.ts.
The agent must return: (a) the full key universe = en leaves union matcher keys
union admin keys; (b) the placeholder syntax and the exact regex that captures
a placeholder (the `{name}` form); (c) the exact contents and the intent of
each of the two allow-list Sets, so the registry seed preserves them verbatim.

STEP 2 - CHOOSE ORCHESTRATION AND EXECUTE
Run the Workflow pipeline described under ULTRACODE. Two slices.

Slice A - scanner and registry:
- Write scripts/i18n_scan.mjs. Zero dependencies, no network.
- It enumerates the key universe with a deterministic, sorted ordering.
- Per key it computes srcHash = hash(English text + sorted placeholder set).
  The sorted placeholder set MUST be part of the hash input.
- For each locale it checks the overlay (and the matcher and admin DICTs, as
  appropriate to where the key lives) for presence and for a stored-hash match.
- It writes src/ui/i18n.status.json with, per key, an `enHash` and a per-locale
  state of translated / pending / blocked, plus the srcHash and `by` for
  translated rows and the `reason` for blocked rows.
- It carries a do-not-edit banner at the top of the generated JSON (or an
  adjacent sentinel if raw JSON cannot hold a comment; match how the repo
  already marks generated artifacts).
- Add an `i18n:scan` script to package.json and wire it into `pretest` and the
  build so the registry regenerates as part of normal flows.

Slice B - allow-list views and sync test:
- Seed the registry's `blocked` rows from the current COPIED_ALLOW and
  ALLOW_V07_SLASH Sets so existing behavior is preserved exactly.
- Replace the two literal Sets in tests/localization_fixes.test.ts with
  generated views derived from the registry (the cognate entries and the
  blocked entries). The views must reproduce the prior whitelist behavior
  exactly: no test that passes today may start failing.
- Add a registry-in-sync test asserting: every en, matcher, and admin key has a
  registry row; no overlay holds a key absent from en; each `enHash` matches the
  recomputed English hash; and the registry is reproducible (regenerate, then
  `git diff --exit-code` on i18n.status.json is clean).

INVARIANTS for this phase:
- The registry is generated, reproducible, and never hand-edited.
- srcHash MUST include the sorted placeholder set, or placeholder parity
  (the M1c guard) can regress silently later.
- Everything is still dense, so the pending set is empty this phase.
- The allow-list views must reproduce the existing whitelist behavior exactly.
- No new dependency. Explicit-path commits only.

OUT OF SCOPE (do not start these here):
- No type relaxation and no sparse overlays (Phase 6).
- No CI split (Phase 6).
- No worklist tooling (Phase 7).
- No admin migration (Phase 8).
- The scanner does NOT call any model or any network.

STEP 3 - VALIDATION AND REVIEW
- npx tsc --noEmit
- Run the scanner, then `git diff --exit-code` on src/ui/i18n.status.json to
  prove reproducibility.
- Run the registry-in-sync test.
- Byte-equivalence gate: the resolved translation table must be unchanged.
- npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts
- npm run build
Then spawn parallel review agents (COVERAGE, not filtering: report everything,
do not pre-judge): privacy-security-review and cross-platform-sync (the matcher
key universe feeds the registry, so cross-platform-sync is load-bearing here).
Use truncation-resume if a review agent is cut off. Do not commit while any
BLOCKING finding stands.

STEP 4 - COMMIT CADENCE (three commits, explicit paths)
1. feat(i18n): add no-LLM status scanner and generated registry
2. feat(i18n): derive COPIED_ALLOW and ALLOW_V07_SLASH from the registry
3. test(i18n): add registry-in-sync and reproducibility checks

STEP 5 - ACCEPTANCE
- i18n_scan.mjs builds i18n.status.json with translated / pending / blocked
  states plus srcHash and enHash, under a do-not-edit banner.
- srcHash includes the sorted placeholder set.
- The allow-lists are registry views that reproduce prior behavior exactly.
- Registry-in-sync and reproducibility checks are green.
- The pending set is empty (still dense).
- The resolved translation table is byte-identical.
- tsc, the named suite, and the build are all green.

STEP 6 - DOC UPDATES
- progress.md: tick the Phase 5 checklist.
- state.md: add additions-log row 5 - new file src/ui/i18n.status.json; new
  script i18n:scan (wired into pretest and build); allow-lists are now views
  over the registry; note that the pending set stays empty until Phase 6.

STEP 7 - FINAL RESPONSE FORMAT
Report: status; files changed (absolute paths); validation results (each
command and its outcome); review verdicts; anything deferred; and an explicit
handoff to Phase 5 QA (phase-05-qa.md).

STOPPING RULES:
- Stop if the registry cannot be made reproducible. Deterministic key ordering
  and deterministic hashing are required; if they cannot be guaranteed, stop
  and report rather than ship a flaky artifact.
- Stop if the allow-list-view swap would cause any currently-passing
  localization test to start failing.
```
