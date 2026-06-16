# Phase 5 QA: Verify status registry and scanner

This is the QA companion to `phase-05-status-registry.md`. Paste the fenced
block below into a fresh Claude Code session to verify the Phase 5
implementation. It assumes Phase 5 has already been implemented and committed.

## Context recap

Phase 5 added a generated status registry `src/ui/i18n.status.json` and a
no-LLM, no-network scanner `scripts/i18n_scan.mjs`. Per key per locale the
registry records `translated` (with `srcHash` = hash of English text plus
sorted placeholder set, and `by: human|agent`), `pending`, or `blocked` (with a
required human `reason`). The hand-maintained `COPIED_ALLOW` and
`ALLOW_V07_SLASH` Sets in `tests/localization_fixes.test.ts` were replaced by
generated views over the registry. Because everything is still dense after
Phase 4, the `pending` set must be empty at the end of Phase 5. Real
sparseness arrives in Phase 6.

The locked decisions and invariants from the implementation doc still apply:
dense artifact typed `: typeof en`, flat dotted overlays with nested `en`,
sim/server stay language-agnostic, determinism untouched, no new dependency,
generated files never hand-edited, byte-equivalence of the resolved table, and
explicit-path commits on a shared worktree.

## QA starter prompt

```text
This is Phase 5 QA of the i18n Scaling feature: Verify status registry and scanner.

MODEL: Opus 4.8 (claude-opus-4-8).
HARNESS: Claude Code, autonomous multi-step. This is a verification pass over an
already-implemented phase.
ULTRACODE: optional. Add it if you want an adversarial-verify sweep that
re-derives the registry classification independently and diffs it against the
committed i18n.status.json, rather than trusting the scanner's own output.

STEP 0 - PRE-FLIGHT
- Confirm the git worktree is clean (shared tree; do not disturb other
  sessions' files).
- Scan memory for prior decisions on this feature.

STEP 1 - LOAD CONTEXT
Spawn one Explore agent to summarize:
- docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md.
- phase-05-status-registry.md (the acceptance criteria and invariants).
- The git diff since the start of Phase 5 (what actually changed).
The agent returns the acceptance list, the invariants, and the concrete set of
files touched, so QA checks against intent rather than guesswork.

STEP 2 - PARALLEL QA AGENTS (COVERAGE, not filtering)
Spawn these in parallel. Each reports everything it finds; do not pre-judge or
suppress. Use truncation-resume if any agent is cut off.

1. Correctness:
   - The registry covers the full key universe (en leaves union matcher keys
     union admin keys); no key is missing a row.
   - srcHash includes the sorted placeholder set, not just the English text.
   - The per-key per-locale states are correct for the current dense world.
   - The allow-list views match the old COPIED_ALLOW and ALLOW_V07_SLASH Sets
     exactly (same entries, same effect).
   - The pending set is empty while everything is dense.
   - The registry is reproducible (regenerate, then git diff is clean).

2. Test-coverage:
   - The registry-in-sync test actually fails if a key is dropped from the
     universe or if an overlay holds a key absent from en (force these to
     confirm the test bites, then revert).
   - A srcHash test proves that changing the English text, or changing a
     placeholder, moves the hash (so staleness detection cannot regress).
   - Add coverage for the scanner itself if it is thin.

3. Dead-code / cleanup:
   - The literal COPIED_ALLOW and ALLOW_V07_SLASH Sets are gone from
     tests/localization_fixes.test.ts.
   - No leftover hand-maintained allow-lists anywhere.
   - No unused imports left behind by the swap.

Also spawn: privacy-security-review, cross-platform-sync (the matcher key
universe feeds the registry, so parity matters), and qa-checklist.

STEP 3 - FIX, RE-RUN, COMMIT
For each BLOCKING finding, fix it, then re-run validation:
- npx tsc --noEmit
- Run the scanner, then git diff --exit-code on src/ui/i18n.status.json.
- npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts
- npm run build
Commit fixes separately, with explicit file paths and conventional-commit
messages.

STEP 4 - DOC UPDATES
Update progress.md and state.md to reflect QA outcomes (passed checks, any fixes
applied, any follow-ups deferred).

STEP 5 - TEARDOWN
Skip packet teardown. This is not the final phase.

STEP 6 - VERDICT AND HANDOFF
Give a clear PASS or FAIL verdict with the evidence behind it (commands run and
their results). Then hand off to Phase 6, which is the unlock: type relaxation,
sparse overlays, and the CI split now that the registry exists to track which
keys are genuinely pending.

STOPPING RULE:
- Stop if reproducibility or registry-in-sync cannot be made green. A
  non-reproducible registry or a sync test that cannot pass blocks the phase;
  report rather than paper over it.
```
