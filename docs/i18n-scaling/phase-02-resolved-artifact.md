# Phase 2 - Dense resolved generated artifact

Add the generated dense artifact that is the load-bearing tsc safety net. A zero-dependency `.mjs` build script overlays every locale onto `en`, fills any gap from English, and emits `src/ui/i18n.resolved.generated.ts` typed `: typeof en` with a do-not-edit banner. The client and admin import that generated file (so tsc still red-fails any missing or renamed key), and the direct-read helpers are repointed at the dense table. Still dense, still nested, no behavior change; gated by reproducibility and byte-equivalence.

## Whole-packet context (shared across all phases)

- Whole-packet goal: an English-only PR passes CI; the full 14-locale fill happens at release; no silent English is ever shipped to a translated player.
- Locked decisions that constrain every phase:
  1. Two-tier CI gate (English-only PR passes; full fill enforced at release).
  2. A dense generated artifact `src/ui/i18n.resolved.generated.ts`, typed `: typeof en`, keeps tsc safety.
  3. Flat dotted-key overlays for the 13 non-English locales; `en` stays NESTED (it drives `TranslationKey = Leaves<typeof en>`, roughly 3,532 call sites).
  4. `t()` throws on untracked keys in dev and test, and renders English for registry-`pending` keys on non-release builds only.
- Invariants for the whole packet: sim and server stay language-agnostic; determinism untouched; no new runtime dependency and no i18n framework (plain TS plus a `.mjs` sibling to `scripts/build_media_manifest.mjs`); generated files are never hand-edited (do-not-edit banner plus a reproducibility check, like the media manifest); shared worktree, so commit with EXPLICIT paths and never `git add -A`.
- Cross-phase cheat sheet lives at `docs/i18n-scaling/state.md`; running status lives at `docs/i18n-scaling/progress.md`.
- The byte-equivalence safety net was built in Phase 1: a resolved 14-locale table SHA-256, baseline stored at `src/ui/i18n.resolved.sha256`, test at `tests/i18n_resolved_equivalence.test.ts`, hash script at `scripts/i18n_resolved_hash.mjs`.
- Phase 1 already: extracted the nested `en` object into `src/ui/i18n.en.ts`; reduced `src/ui/i18n.ts` to a thin runtime that preserves all public exports; and split the 13 nested locales into their own files. The runtime read-paths that read the translation table directly are `tOptional`, `hasTranslation`, and an internal `translationValue`. The client entry `src/main.ts` imports from `./ui/i18n`; the admin app under `src/admin/` keeps its own `src/admin/i18n.ts` DICT in a separate bundle.

## Implementation starter prompt

Paste the block below into a fresh Claude Code session to execute this phase.

```
This is Phase 2 of the i18n Scaling feature: Dense resolved generated artifact.

MODEL / HARNESS
- Model: Opus 4.8 (claude-opus-4-8), max effort. Use the 1m thinking budget on the
  generator-shape and direct-read-repoint decisions where it helps.
- Harness: Claude Code.
- ULTRACODE is NOT required: this is a small, careful build-tooling phase, not a
  sprawling refactor. Parallel Agent fan-out for independent investigation and
  per-file batch work is fine and encouraged.

GOAL
Generate src/ui/i18n.resolved.generated.ts (nested, dense, every locale filled from
English where missing, typed `: typeof en`, with a do-not-edit banner) from a
zero-dependency .mjs build script, then repoint the runtime direct-read helpers,
the client, and the admin to consume that generated artifact, with reproducibility
and byte-equivalence gates green.

STEP 0 - PRE-FLIGHT
- Run a git clean check. This is a SHARED checkout, so if the tree is dirty in files
  you did not expect, STOP and ASK before doing anything; do not stash or revert
  another session's work.
- Scan memory for the entries that bind here: shared-worktree-commit-care (stage only
  your own files, commit with explicit paths, sometimes commit nothing) and
  no-em-dashes-or-emojis (none in code, comments, commits, or docs).

STEP 1 - LOAD CONTEXT
Fan out one Explore agent (read-only) to summarize and return concrete facts:
- docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md (where Phase 1 left
  off, the additions log, any open gotchas).
- This phase file (docs/i18n-scaling/phase-02-resolved-artifact.md).
- The Phase 1 output structure: src/ui/i18n.en.ts (the nested en object and how it is
  exported), the 13 split locale files (their paths, names, and export shape), and the
  thin src/ui/i18n.ts runtime, specifically the EXACT current implementations of
  tOptional, hasTranslation, and the internal translationValue (how they reach the
  table today, and what the table object is called).
- scripts/build_media_manifest.mjs as the generated-artifact pattern to copy: its
  do-not-edit banner text, how it writes deterministically, and how its reproducibility
  is checked.
- How src/main.ts imports i18n (it imports from ./ui/i18n) and how src/admin/ uses its
  own src/admin/i18n.ts DICT.
The agent must RETURN: the assembler shape (what `translations` looks like and how
locales are keyed), the exact direct-read helper implementations to repoint, and the
precise import sites to repoint. Capture these before writing any code.

STEP 2 - CHOOSE ORCHESTRATION AND EXECUTE
You may run the two slices below as parallel Agents once Step 1 facts are in hand;
Slice B depends on Slice A's output file existing, so either sequence them or have B
write against the agreed artifact path and shape and reconcile at the end.

Slice A - generator
- Write scripts/i18n_build.mjs with ZERO dependencies (Node built-ins only). It:
  - imports the nested `en` and the locale objects produced by Phase 1 (use the same
    module shape Phase 1 exposes; do not re-author the locale data);
  - overlays each locale onto a deep copy of `en`, filling any missing leaf from the
    English value so every emitted locale is DENSE (no gaps);
  - emits src/ui/i18n.resolved.generated.ts that exports the dense `translations`
    object typed `: typeof en`, NESTED, with a manifest-style do-not-edit banner at the
    top (mirror the wording style of build_media_manifest.mjs);
  - writes deterministically: stable key ordering (drive ordering from `en` so two runs
    on the same input are byte-identical), fixed indentation, trailing newline,
    consistent quoting. No timestamps, no Date.now, no Math.random anywhere.
- Add an `i18n:build` script to package.json that runs node scripts/i18n_build.mjs.
- Wire i18n:build into `npm run build` BEFORE the vite step, and into `pretest`, so the
  generated artifact is always fresh for type-check, tests, and bundling.

Slice B - consumers and reproducibility
- Repoint the runtime so t, tOptional, hasTranslation, and translationValue read from
  the generated dense table in src/ui/i18n.resolved.generated.ts, NOT from the raw
  per-locale objects. This is a CORRECTNESS item, not a tidy-up: under future sparse
  overlays (Phase 3 and beyond) the raw locale objects will no longer be dense, so a
  helper still reading them directly would silently return undefined or the wrong
  value. The dense generated table is the single read source for all four.
- Update the client import path so src/main.ts (and anything under the client bundle
  that reads the table) consumes the generated artifact through the runtime, keeping
  all public exports of src/ui/i18n.ts stable.
- Update src/admin/ to import the generated artifact (the admin DICT consumer) so the
  admin bundle also type-checks against the generated table.
- Add a reproducibility test: regenerate via node scripts/i18n_build.mjs, then assert
  `git diff --exit-code` is clean on src/ui/i18n.resolved.generated.ts. Fold this into
  tests/i18n_resolved_equivalence.test.ts or add a clearly named sibling test file.

INVARIANTS (do not violate)
- The generated artifact is NESTED and typed `: typeof en`, so tsc still red-fails any
  missing or renamed key. Do not flatten it here.
- The do-not-edit banner is present at the top of the generated file; never hand-edit
  the generated file.
- The resolved output is BYTE-IDENTICAL to the Phase 1 resolved table (same content,
  same fill-from-English semantics). The Phase 1 SHA-256 baseline must not change.
- The direct-read helpers MUST point at the dense generated table. If any of t,
  tOptional, hasTranslation, or translationValue still reads a raw locale object, that
  is a bug that ships wrong text under future sparse overlays. Call this out explicitly
  in your own review.
- No new dependencies. Plain TS plus the .mjs script only.
- Commit with explicit paths only; never `git add -A`.

OUT OF SCOPE (later phases)
- No flattening of overlays (Phase 3).
- No dialect dedup (Phase 4).
- No registry (Phase 5).
- No sparse types and no change to t()-miss behavior (Phase 6).

STEP 3 - VALIDATION AND REVIEW
Run, in order, and fix until green:
- npx tsc --noEmit
- Regenerate (node scripts/i18n_build.mjs) then confirm `git diff --exit-code` is clean
  on src/ui/i18n.resolved.generated.ts (reproducibility).
- The byte-equivalence gate: resolved-table SHA-256 unchanged versus the Phase 1
  baseline at src/ui/i18n.resolved.sha256.
- npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts
  tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts
- npm run build (confirm both the client and admin bundles build).
Then fan out parallel review agents (COVERAGE, not filtering: surface everything, do
not pre-suppress):
- privacy-security-review (always).
- cross-platform-sync (this phase changes read-paths and the IWorld-adjacent seam
  consumers; verify the client/admin/runtime all agree on the one read source).
If a review agent's output is truncated, send a truncation-resume message and continue.
Do NOT commit while any BLOCKING finding is open.

STEP 4 - COMMIT CADENCE (three commits, explicit paths)
1. feat(i18n): add resolved-artifact build script and generated dense table
   (scripts/i18n_build.mjs, src/ui/i18n.resolved.generated.ts, package.json wiring)
2. feat(i18n): consume generated dense table in runtime, client, and admin
   (src/ui/i18n.ts, src/main.ts as needed, src/admin/ import update)
3. test(i18n): add resolved-artifact reproducibility check
   (the reproducibility test in or beside tests/i18n_resolved_equivalence.test.ts)

STEP 5 - ACCEPTANCE (all must hold)
- scripts/i18n_build.mjs emits a nested artifact typed `: typeof en` with a do-not-edit
  banner.
- i18n:build is wired into npm run build (before vite) and into pretest.
- The runtime direct-read helpers (t, tOptional, hasTranslation, translationValue), the
  client, and the admin all import or read the generated artifact.
- The reproducibility test is green.
- The resolved table is byte-identical to Phase 1 (SHA-256 unchanged).
- tsc, the targeted suite, and npm run build are all green.

STEP 6 - DOC UPDATES
- progress.md: tick the Phase 2 checklist.
- state.md: add additions-log row 2 (new file src/ui/i18n.resolved.generated.ts; new
  script i18n:build; note the direct-read repoint as a resolved gotcha now closed: all
  four read-paths read the dense generated table, not raw locale objects).

STEP 7 - FINAL RESPONSE FORMAT
Report: status; files changed; validation results (tsc, reproducibility,
byte-equivalence SHA, vitest targets, build); review-agent verdicts; any deferrals;
and a one-line handoff to Phase 2 QA.

STOPPING RULES
- STOP if the generated artifact cannot be made byte-identical to the Phase 1 resolved
  table (investigate fill-from-English semantics and key ordering before forcing it).
- STOP if reproducibility cannot be made deterministic (chase the non-determinism;
  do not paper over it by relaxing the test).
```
