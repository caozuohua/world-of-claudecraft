# Phase 1 QA - Verify Foundation and monolith split

This is the verification pass for Phase 1. It audits every Phase 1 deliverable
and acceptance item, confirms the split was truly behavior-preserving (resolved
table byte-identical, all public exports intact), and proves the new
byte-equivalence test is meaningful rather than vacuous. Phase 1 is NOT the final
phase, so there is no packet teardown here.

## Shared packet context (read first, applies to every phase)

- Whole-packet goal: an English-only PR compiles and passes CI; the full
  14-locale fill happens once at release; no English is ever silently shipped to
  a translated player.
- Locked decisions (all phases share these): (1) a two-tier CI gate (PR vs
  release); (2) a dense generated artifact `src/ui/i18n.resolved.generated.ts`
  typed `: typeof en` preserves tsc safety; (3) flat dotted-key overlays for the
  13 non-English locales, but `en` stays a NESTED object because it is
  authoritative and drives `TranslationKey = Leaves<typeof en>` used by ~3,532
  call sites; (4) `t()` throws on untracked keys in dev/test and renders English
  for registry-`pending` keys on non-release builds only.
- Invariants every phase keeps: `src/sim/` and `server/` stay language-agnostic
  (no `t()`, no DOM); determinism untouched (no `Math.random`/`Date.now`/
  `performance.now` in `src/sim/`); no new runtime dependency or i18n framework;
  generated files are never hand-edited; shared worktree, so stage EXPLICIT
  paths, never `git add -A`.
- The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN,
  zh_TW, ko_KR, ja_JP, pt_BR, ru_RU.
- Byte-equivalence safety net: every behavior-preserving phase is gated by
  SHA-256 byte-equivalence of the resolved 14-locale table; the table is
  1,583,881 bytes on main. Cross-phase cheat sheet: `docs/i18n-scaling/state.md`;
  live status: `docs/i18n-scaling/progress.md`.

## QA starter prompt

Paste the block below into a fresh Claude Code session to QA Phase 1.

```
This is Phase 1 QA of the i18n Scaling feature: Verify Foundation and monolith
split.

Model: Opus 4.8, max effort, 1m context variant where the file load demands it.
Harness: Claude Code.

STEP 0 PRE-FLIGHT
- Run `git status`. If the tree is dirty with work that is not the Phase 1 diff,
  STOP and ask the user: this is a shared checkout.
- Scan Claude Code memory: read the MEMORY.md index and the entries
  shared-worktree-commit-care and no-em-dashes-or-emojis.
- Confirm you are on the same branch Phase 1 committed to.

STEP 1 LOAD CONTEXT (do NOT read the big files in the main loop)
- Spawn one Explore agent and have it summarize, NOT dump:
  - docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md.
  - docs/i18n-scaling/phase-01-foundation-split.md (the acceptance criteria and
    invariants you are verifying).
  - The git diff since the Phase 1 start commit (the three Phase 1 commits):
    which files were added, moved, and trimmed, and a structural description of
    each, NOT a line dump of the big locale files.
- The agent must RETURN: the list of new/moved/trimmed files; the public export
  list of the new src/ui/i18n.ts; and where en, the type machinery, and the
  per-locale data now live.

STEP 2 QA AUDIT (parallel agents)
Dispatch these in parallel. Prompt EVERY agent for COVERAGE not filtering
(report every plausible issue; do not pre-suppress). If any agent truncates or
stalls, resume it with exactly: "Stop reading. Output verdict now."

- Correctness agent: verify every Phase 1 deliverable and every acceptance item.
  Confirm all public exports of the old i18n.ts are preserved in name and
  signature by checking that importers across src/ still compile and import the
  same names. Confirm `en` is still NESTED in src/ui/i18n.en.ts. Confirm the 13
  locale files are behavior-preserving (still nested, still `: typeof en`, no
  key added/dropped/reordered relative to the resolved baseline).
- Test-coverage agent: verify the equivalence test is MEANINGFUL, that is it
  actually fails if the resolved table changes. Prove it by temporarily mutating
  one locale value (or stubbing the assembled table) and confirming
  tests/i18n_resolved_equivalence.test.ts goes red, then reverting. If the hash
  script or the thin runtime lacks coverage, add focused tests.
- Dead-code / cleanup agent: confirm no leftover duplicate locale blocks remain
  inside src/ui/i18n.ts, no unused imports were left behind in the trimmed
  runtime or the new files, and the src/sim import invariant is intact (src/sim/
  imports nothing from ui/render/game/net and introduces no t()/DOM).

Also dispatch, all prompted for COVERAGE not filtering, same truncation-resume
message:
- privacy-security-review.
- cross-platform-sync (the localize seam and the public exports were touched).
- qa-checklist (Phase 1: foundation split; cross-reference root and src/ui
  CLAUDE.md i18n rules).

STEP 3 FIX
- Apply BLOCKING and SHOULD-FIX findings. Leave NICE-TO-HAVE for later phases
  unless trivial.
- Re-run the full validation matrix:
  - `npx tsc --noEmit`
  - `npx vitest run tests/localization_fixes.test.ts
    tests/localization_coverage.test.ts tests/server_i18n.test.ts
    tests/i18n_resolved_equivalence.test.ts`
  - The byte-equivalence gate: re-run the hash script; SHA-256 MUST equal the
    committed src/ui/i18n.resolved.sha256 baseline (and the table is still
    1,583,881 bytes).
  - `npm run build`.
- Commit fixes SEPARATELY from the Phase 1 implementation commits, Conventional
  Commits with scope, explicit paths only (shared worktree), no em dashes, no
  emojis. Example: fix(i18n): address Phase 1 QA findings.

STEP 4 DOC UPDATES
- Update docs/i18n-scaling/progress.md (Phase 1 QA done, any follow-ups logged).
- Update docs/i18n-scaling/state.md if QA changed any file inventory or added
  tests.

STEP 5 PACKET TEARDOWN
- Phase 1 is NOT the final phase. Skip packet teardown.

STEP 6 FINAL RESPONSE FORMAT
Report, in this order:
- QA verdict: PASS / PASS-WITH-FOLLOWUPS / FAIL.
- Counts: issues found, issues fixed, by severity (BLOCKING / SHOULD-FIX /
  NICE-TO-HAVE).
- Validation results (tsc, the four test files, the byte-equivalence gate value,
  build).
- Review verdicts (privacy-security-review, cross-platform-sync, qa-checklist).
- Deferred items handed to a later phase.
- One-line handoff to Phase 2.

STOPPING RULE
- STOP and surface to the user if byte-equivalence cannot be made green: a
  resolved hash that no longer matches the baseline means the Phase 1 split
  altered output, which is a bug to investigate, not a number to re-baseline.
```
