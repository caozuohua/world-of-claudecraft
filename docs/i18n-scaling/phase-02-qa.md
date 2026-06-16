# Phase 2 QA - Dense resolved generated artifact

Verify that Phase 2 landed correctly: the generated dense artifact is truly generated and reproducible, the runtime direct-read helpers plus client and admin consume it, tsc still enforces completeness against it, and the resolved table is byte-identical to Phase 1. This is a verification pass; it fixes only what it finds, in separate commits.

## Whole-packet context (shared across all phases)

- Whole-packet goal: an English-only PR passes CI; the full 14-locale fill happens at release; no silent English is ever shipped to a translated player.
- Locked decisions: two-tier CI gate; dense generated artifact `src/ui/i18n.resolved.generated.ts` typed `: typeof en` keeps tsc safety; flat dotted-key overlays for the 13 non-English locales while `en` stays NESTED (drives `TranslationKey = Leaves<typeof en>`, roughly 3,532 call sites); `t()` throws on untracked keys in dev and test, renders English for registry-`pending` keys on non-release builds only.
- Invariants: sim and server stay language-agnostic; determinism untouched; no new runtime dependency and no i18n framework (plain TS plus a `.mjs` sibling to `scripts/build_media_manifest.mjs`); generated files never hand-edited (do-not-edit banner plus reproducibility check); shared worktree, so EXPLICIT-path commits, never `git add -A`.
- Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.
- Byte-equivalence safety net from Phase 1: resolved 14-locale table SHA-256, baseline at `src/ui/i18n.resolved.sha256`, test at `tests/i18n_resolved_equivalence.test.ts`, hash script at `scripts/i18n_resolved_hash.mjs`.
- What Phase 2 was supposed to deliver: `scripts/i18n_build.mjs` (zero-dep generator) emitting nested `src/ui/i18n.resolved.generated.ts` typed `: typeof en` with a do-not-edit banner; `i18n:build` wired into `npm run build` (before vite) and `pretest`; runtime helpers `t`, `tOptional`, `hasTranslation`, `translationValue` repointed at the dense generated table; client (`src/main.ts` via `./ui/i18n`) and admin (`src/admin/`) consuming the generated artifact; a reproducibility test folded into or beside `tests/i18n_resolved_equivalence.test.ts`.

## QA starter prompt

Paste the block below into a fresh Claude Code session to QA this phase.

```
This is Phase 2 QA of the i18n Scaling feature: Verify Dense resolved generated artifact.

MODEL / HARNESS
- Model: Opus 4.8 (claude-opus-4-8), max effort. 1m thinking budget where the
  reproducibility or byte-equivalence reasoning needs it.
- Harness: Claude Code.
- Parallel Agent fan-out for the QA dimensions below is expected.

STEP 0 - PRE-FLIGHT
- Git clean check. SHARED checkout: if dirty in unexpected files, STOP and ASK; do not
  stash or revert another session's work.
- Memory scan: shared-worktree-commit-care (explicit-path commits, never git add -A),
  no-em-dashes-or-emojis.

STEP 1 - LOAD CONTEXT
Fan out one Explore agent (read-only) to summarize and return:
- docs/i18n-scaling/state.md, docs/i18n-scaling/progress.md, and
  docs/i18n-scaling/phase-02-resolved-artifact.md (the acceptance criteria to verify
  against).
- The git diff since the phase started (the Phase 2 commits): scripts/i18n_build.mjs,
  src/ui/i18n.resolved.generated.ts, package.json, src/ui/i18n.ts, src/main.ts as
  touched, src/admin/ as touched, and the reproducibility test.
Return: the actual deliverables present, the read-path wiring as implemented, and any
gaps versus the Phase 2 acceptance list.

STEP 2 - PARALLEL QA AGENTS (COVERAGE, not filtering)
Run these concurrently. Each must surface everything it finds and classify
BLOCKING vs non-blocking; do not pre-suppress. On truncation, send a resume message.

- Correctness agent:
  - Verify every Phase 2 deliverable and acceptance item is actually met.
  - Verify the artifact is TRULY generated (regenerate via node scripts/i18n_build.mjs
    and confirm git diff --exit-code is clean) and reproducible across two runs.
  - Verify the do-not-edit banner is present and matches the manifest style.
  - Verify the direct-read helpers (t, tOptional, hasTranslation, translationValue) read
    the dense generated table, NOT raw per-locale objects (the correctness risk under
    future sparse overlays).
  - Verify src/main.ts (client) and src/admin/ both import or consume the generated
    artifact.
  - Verify tsc still enforces completeness against the artifact: confirm the artifact is
    typed `: typeof en` and that a deliberately missing or renamed key would red-fail
    tsc (reason through it; do not commit a real break).
  - Confirm byte-equivalence: resolved-table SHA-256 unchanged versus the Phase 1
    baseline at src/ui/i18n.resolved.sha256.

- Test-coverage agent:
  - Verify the reproducibility test actually FAILS if the generated artifact is
    hand-edited or left stale (prove it: temporarily mutate the artifact in a scratch
    check, confirm the test goes red, then restore; do not commit the mutation).
  - Add coverage for the build script's gap-fill logic: a locale missing a leaf must be
    filled from the English value, and a present leaf must be preserved (assert on
    representative keys). Keep new tests deterministic.

- Dead-code / cleanup agent:
  - Confirm no stale direct reads of the raw per-locale objects remain anywhere in the
    runtime or consumers (all reads go through the generated dense table).
  - Confirm no unused imports were left behind after the repoint (raw locale imports
    that are now dead, etc.).

Also run (always, COVERAGE not filtering, truncation-resume as needed):
- privacy-security-review
- cross-platform-sync (read-path and seam-consumer change: client, admin, runtime must
  agree on the single read source)
- qa-checklist (Phase 2 scope: determinism of the generator, generated-file invariant,
  build gate, i18n).

STEP 3 - FIX AND RE-RUN
- Fix every BLOCKING finding. Re-run the full validation matrix:
  - npx tsc --noEmit
  - node scripts/i18n_build.mjs then git diff --exit-code clean on the generated file
  - byte-equivalence SHA-256 unchanged versus Phase 1 baseline
  - npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts
    tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts
  - npm run build (client + admin)
- Commit fixes SEPARATELY from the Phase 2 implementation commits, explicit paths only,
  Conventional Commits with the i18n scope (for example
  test(i18n): cover build-script gap-fill, fix(i18n): repoint stale direct read).

STEP 4 - DOC UPDATES
- progress.md: mark Phase 2 QA done and note any fixes applied.
- state.md: if QA changed anything material (a new test, a closed gotcha), update the
  additions log accordingly.

STEP 5 - PACKET TEARDOWN
- Skip packet teardown (this is not the final phase).

STEP 6 - FINAL RESPONSE FORMAT
Report: overall verdict (PASS / PASS WITH FIXES / BLOCKED); per-agent verdicts; what was
fixed and the fix commits; validation matrix results; any deferrals; and a one-line
handoff to Phase 3 (overlay flattening).

STOPPING RULE
- STOP if reproducibility or byte-equivalence cannot be made green (chase the root cause:
  generator non-determinism, key ordering, or fill-from-English semantics drift versus
  the Phase 1 resolved table). Do not relax the gate to force a pass.
```
