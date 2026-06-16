# Phase 7 QA: Verify release fill tooling and docs

This is Phase 7 QA of the i18n Scaling feature: Verify release fill tooling and docs.

## Context

Phase 7 added `scripts/i18n_fill_worklist.mjs`, a data-only tool that turns the
registry's `pending` slice into a deterministic per-language delta of
`{ key, english, placeholders, siblings }`, ships a locked-terms glossary with every
batch, and segregates `blocked` prose to a human-required section that the auto-fillable
batch can never reach. It also documented the contributor workflow (English-only PR is
green) and the maintainer release-fill workflow (run the worklist, fill overlays, never
auto-fill blocked prose, re-scan, release gate goes green), and recorded the OPEN
ownership and API-key item.

The invariants this phase must not violate: the tool is data-only (no LLM, no network);
output is deterministic so an unchanged repo is a no-op; blocked prose never enters the
auto-fillable batch; the glossary ships with every batch; no new dependency; sim and
server stay language-agnostic; generated files are never hand-edited; shared worktree, so
commit with explicit paths.

Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.

---

## QA starter prompt

Paste the block below into a fresh Claude Code session.

```
This is Phase 7 QA of the i18n Scaling feature: Verify release fill tooling and docs.

MODEL: Opus 4.8 (claude-opus-4-8) recommended. Baseline behavior if the identity line
is stale. HARNESS: Claude Code. Use parallel Agent fan-out for the QA passes in STEP 2.

STEP 0 - PRE-FLIGHT
- Confirm the working tree state for the Phase 7 files. Shared worktree: do not revert or
  stash other sessions' work. Note the current branch.
- Scan memory for prior notes on this feature and the shared-worktree commit policy.

STEP 1 - LOAD CONTEXT
- Launch one Explore agent to summarize and return as text:
  - docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md (Phase 7 rows).
  - docs/i18n-scaling/phase-07-release-fill-tooling.md (the implementation spec).
  - The git diff since the phase started (the Phase 7 commits): the new
    scripts/i18n_fill_worklist.mjs, the glossary data, the package.json i18n:worklist
    script, and the doc changes in src/ui/CLAUDE.md and docs/i18n-scaling/.
- The agent returns: what was built, the exact files touched, and any gap between the
  spec's acceptance list and what landed.

STEP 2 - PARALLEL QA AGENTS (COVERAGE, not filtering: report every finding; do not
suppress. Resume any truncated agent until complete.)

  A. Correctness (general-purpose or claude):
     - The worklist is DATA-ONLY: grep the script and anything it imports for network
       calls (fetch, http, https, net, dns), LLM or SDK calls (anthropic, openai, any
       model client), and dynamic imports that could reach out. There must be none.
     - It is DETERMINISTIC: run npm run i18n:worklist twice on the unchanged repo and
       diff the output; it must be byte-identical and a reported no-op.
     - It SEGREGATES blocked prose: confirm blocked keys appear only in the
       human-required section and never in the auto-fillable batch. Construct a check
       that a consumer of the auto-fillable batch cannot reach a blocked key.
     - It SHIPS the glossary with every per-language batch.
     - It ROUND-TRIPS with the scanner: introduce a sample pending key via i18n:scan,
       confirm it lands in the right language batch with english + placeholders +
       siblings, fill it, re-scan, confirm pending shrinks, then remove the sample.
     - The DOCS accurately describe the green-PR contributor workflow and the maintainer
       release-fill workflow, and the OPEN ownership and API-key item is recorded.

  B. Test-coverage (general-purpose or claude):
     - Confirm a test proves the worklist no-ops on an unchanged repo (byte-identical
       output) and that a blocked key never appears in the auto-fillable batch.
     - If that coverage is missing, ADD it (a Vitest test that drives the tool against a
       fixture registry, or extends the existing localization tests). The test must fail
       if a blocked key leaks into the auto-fillable batch or if output is unstable.

  C. Dead-code and cleanup (general-purpose or claude):
     - No stray network or LLM calls, no unused imports, no leftover scaffolding.
     - The docs and new files contain NO em dashes and NO emojis.
     - The glossary location matches what state.md records.

  D. privacy-security-review (agent): focus on the tool being data-only and not exfiltrating
     anything, and on the worklist output not embedding secrets.

  E. cross-platform-sync (agent): confirm sim and server stay language-agnostic and the
     matcher guidance in the docs is consistent with the existing sim_i18n / server_i18n
     mirrors.

  F. qa-checklist (agent): generate and validate a Phase 7 checklist (determinism, i18n
     coverage, build gate, no new dependency).

STEP 3 - FIX AND RE-RUN VALIDATION
  - Fix every BLOCKING finding. Re-run:
      npx tsc --noEmit
      npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts
        tests/server_i18n.test.ts (plus any new Phase 7 test)
      npm run build
  - Commit fixes SEPARATELY with explicit paths, e.g.
      test(i18n): cover worklist determinism and blocked-prose segregation
      fix(i18n): <specific worklist or docs fix>
  - Do not commit while any verdict is BLOCKING.

STEP 4 - DOC UPDATES
  - Update docs/i18n-scaling/progress.md (Phase 7 QA result) and, if anything material
    changed, state.md. Keep the ownership and API-key item OPEN.

STEP 5 - TEARDOWN
  - Skip packet teardown (not the final phase).

STEP 6 - FINAL RESPONSE
  - Report the verdict (PASS or the BLOCKING items), files touched, validation results,
    and an explicit handoff to Phase 8 (admin migration). Note the OPEN ownership item
    is still open.

STOPPING RULE
  - Stop and report if the tool is non-deterministic or could route prose to auto-fill.
    Either is a release-blocking defect for this phase.
```
