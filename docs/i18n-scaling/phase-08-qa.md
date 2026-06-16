# Phase 8 QA - Verify admin catalog migration

Independent verification that Phase 8 moved `src/admin/i18n.ts` onto the overlay + registry +
release-gate model correctly: the admin keys are tracked, the admin SPA still renders all 14
locales as a separate bundle, the hardcoded admin strings are localized, and no non-client
surface can leak a pending-English string to a real user. This is a verify-and-fix pass, not a
re-implementation; only touch source if QA turns up a defect.

## Whole-packet context (for the QA session)

- Packet goal: English-only PR passes CI; full 14-locale fill at release; no silent English.
  Operators are users, so the admin dashboard is in scope.
- Locked decisions: two-tier CI gate; dense generated artifact keeps tsc safety; flat dotted-key
  overlays with nested `en`; `t()` throws on untracked in dev, serves English for pending
  non-release, requires empty-pending at release.
- Invariants: sim/server language-agnostic; determinism untouched; no new dependency or
  framework; generated files never hand-edited; shared worktree so EXPLICIT-path commits only;
  NO Postgres schema / DDL / persisted-state change in this packet.
- The admin SPA is a SEPARATE bundle (`admin.html` entry, `src/admin/`). Before Phase 8 the admin
  DICT was a flat dense `Record<locale, Record<key, string>>`, 181 keys x 14 locales, with a
  `classLabel()` helper. The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN,
  zh_TW, ko_KR, ja_JP, pt_BR, ru_RU.
- Cheat sheet `docs/i18n-scaling/state.md`; status `docs/i18n-scaling/progress.md`.

---

## QA starter prompt

Paste the block below into a fresh Claude Code session to run Phase 8 QA.

```
This is Phase 8 QA of the i18n Scaling feature: Verify admin catalog migration.

MODEL: Use Opus 4.8 (claude-opus-4-8) if available; otherwise the strongest model on hand.
HARNESS: Claude Code, shared git worktree. Commit EXPLICIT paths only, never `git add -A`.

STEP 0 PRE-FLIGHT
- Confirm the working tree state with `git status`; note what Phase 8 left staged or modified.
- Scan memory for prior context on this packet and the admin surface.

STEP 1 LOAD CONTEXT (one Explore agent)
Launch an Explore agent to read and summarize: docs/i18n-scaling/state.md,
docs/i18n-scaling/progress.md, docs/i18n-scaling/phase-08-admin-catalog.md, and the git diff
since the start of Phase 8 (the admin overlay split, scanner/registry/worklist wiring, and the
hardcoded-string fixes). It returns: what changed, where the admin English base + overlays +
resolved admin artifact now live, and the list of hardcoded admin strings that were fixed.

STEP 2 PARALLEL QA AGENTS (COVERAGE mode, not filtering - surface everything; truncation-resume
if any agent's output is cut off)

- Correctness agent: verify the admin DICT is genuinely under the overlay + registry +
  release-gate model; the admin bundle is still SEPARATE (no game locale table or game resolved
  artifact imported into admin); the resolved admin table is complete so all 14 locales render;
  the A1 admin classLabel coverage assertion is green; the src/admin/main.ts:401 alert AND every
  other hardcoded admin string is localized; the RFC 9.7 non-client-consumer audit holds (index.html
  hreflang + data-i18n-content meta, document.title, admin.html static markup, admin DICT/table
  cannot surface pending-English to a real user).

- Test-coverage agent: confirm a test PROVES an English-only admin key passes the PR tier, and a
  test PROVES an incomplete admin locale FAILS the release tier. Confirm the registry-in-sync
  coverage actually includes admin keys (not just expects them). Flag any acceptance item with no
  test behind it.

- Dead-code / cleanup agent: confirm there is no leftover duplicate admin DICT data (the old dense
  DICT should be gone or fully derived), no game-table import sneaking into the admin bundle, and
  no unused imports or dead helpers left from the split.

- privacy-security-review (MANDATORY - admin is the operator / moderation surface): no secret or
  privileged data leaks through new strings or the build; admin gating untouched.

- cross-platform-sync: no drift introduced into the sim/server i18n matchers or IWorld seam by
  this change (admin is client-only, but confirm nothing bled across).

- qa-checklist: run the standard Phase 8 checklist against the implementation.

STEP 3 FIX + RE-RUN VALIDATION
- For each BLOCKING finding, fix it (or, if it belongs to a later phase, record the deferral with
  rationale). Re-run: `npx tsc --noEmit`; `npm run build` (admin entry builds, all 14 locales
  resolve, spot-check 2-3); `npx vitest run tests/localization_fixes.test.ts
  tests/localization_coverage.test.ts tests/server_i18n.test.ts`.
- Commit fixes as SEPARATE commits with explicit paths and conventional-commit messages; do not
  fold them into Phase 8's commits.

STEP 4 DOC UPDATES
- progress.md: mark Phase 8 QA done with the verdict.
- state.md: note any QA-found gotcha and its fix; correct any path or audit-result that drifted.

STEP 5 PACKET TEARDOWN
- Skip packet teardown UNLESS Phase 9 is being skipped. If the user has decided to stop the packet
  here, follow the packet-teardown procedure in phase-09-qa.md instead.

STEP 6 VERDICT + HANDOFF
- Give a clear PASS / FAIL verdict with the evidence behind it (validation results + agent
  verdicts). If PASS and continuing, HAND OFF to Phase 9 (pseudo-locale). If PASS and the packet
  stops here, declare the packet complete per the teardown procedure.

STOPPING RULE (stop and surface, do not push through):
- Stop if admin 14-locale completeness regresses, or if any non-client surface can leak a
  pending-English string to a real user.
```
