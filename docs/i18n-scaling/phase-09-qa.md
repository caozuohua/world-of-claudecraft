# Phase 9 QA and Packet Teardown - en_XA and closing the i18n Scaling packet

This is the FINAL QA pass for the whole i18n Scaling packet. It verifies the optional Phase 9
pseudo-locale (en_XA), then runs the whole-feature QA matrix one last time, and finally offers
to tear down the planning scaffolding. Nothing here ships unless the whole-feature invariants
hold and en_XA is provably absent from every user-facing locale enumeration.

## Reference points

Whole-packet goal: an English-only PR passes CI (PR tier), the full 14-locale fill lands at
release (release tier), and no silent English is ever shipped. The shipped locales are: en,
es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU (14).
`index.html` carries hreflang links for those 14. en_XA is dev-only and ships as none of them.

Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.
Whole-feature QA matrix: `docs/i18n-scaling/qa-checklist.md`.

Invariants for the whole packet: sim and server stay language-agnostic; determinism untouched;
no new dependency or framework; generated files never hand-edited; shared worktree, so commit
with EXPLICIT paths only, never `git add -A`.

---

## QA starter prompt

Paste the block below into a fresh Claude Code session.

```
This is Phase 9 QA of the i18n Scaling feature: Verify pseudo-locale and close the packet.

MODEL: Opus 4.8 (claude-opus-4-8). If a different or smaller model, drop to the Sonnet
  baseline (smaller steps, checkpoint before multi-file edits, one investigation subagent).
  Never gate invariants, safety, or correctness on the model line.
HARNESS: ULTRACODE not required. Parallel Agent fan-out for the QA agents is worthwhile;
  the teardown itself is a single careful step.

STEP 0 - PRE-FLIGHT
  - Confirm a clean enough tree to isolate this QA pass. Shared worktree: never `git add -A`;
    stage only files you touch, by explicit path.
  - Find the Phase 9 phase-start SHA (recorded in state.md row 9) so you can diff "since
    phase start".

STEP 1 - LOAD CONTEXT (Explore agent, read-only)
  Summarize and report: docs/i18n-scaling/state.md, docs/i18n-scaling/progress.md,
  docs/i18n-scaling/phase-09-pseudo-locale.md (this phase's intent and acceptance), and the
  git diff since the Phase 9 phase-start SHA. Return: what en_XA actually changed, where it
  is generated, where it is excluded, and any OPEN items the packet still carries (especially
  the literals en_XA surfaced and the release-fill ownership / API-key item).

STEP 2 - PARALLEL QA AGENTS (COVERAGE, not filtering; resume any truncated output)
  Launch in parallel:
    - Correctness: verify en_XA is generated from en (not hand-authored); {placeholders}
      preserved exactly; en_XA is NOT in supportedLanguages, NOT in the hreflang list in
      index.html, NOT required or counted by the release gate / 14-locale parity, and NOT in
      the normal player language picker. Confirm ?lang=en_XA works in dev and is gated to dev.
    - Test-coverage: confirm a test asserts en_XA is ABSENT from supportedLanguages and from
      hreflang. If no such test exists, ADD one (smallest viable assertion) so a future
      regression that leaks en_XA fails CI. Confirm the 14-locale parity test still requires
      exactly the 14 shipped locales.
    - Dead-code / cleanup: any scaffolding, half-wired selector branches, or unused exports
      from the en_XA work that should be removed.
    - privacy-security-review: the dev-only gate truly prevents en_XA reaching production
      users; no leaked flag or secret.
    - cross-platform-sync: en_XA / selector behavior is consistent across the offline browser
      Sim, the online client, and any headless path; no IWorld or matcher drift introduced.
    - qa-checklist: run the agent against the Phase 9 diff to catch determinism / parity /
      i18n / build-gate gaps.

STEP 3 - FIX + RE-RUN VALIDATION
  Fix every BLOCKING finding. Re-run: npx tsc --noEmit; the new/updated en_XA exclusion test;
  npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts;
  npm run build. Commit fixes as SEPARATE, explicitly-pathed commits (e.g.
  test(i18n): assert en_XA excluded from supportedLanguages and hreflang;
  fix(i18n): <specific fix>). Do not bundle unrelated changes.

STEP 4 - WHOLE-PACKET QA (run the full matrix once)
  Work through docs/i18n-scaling/qa-checklist.md end to end, and explicitly confirm:
    - English-only PR PASSES the PR tier of the two-tier gate.
    - An incomplete locale FAILS the release tier (the release gate still catches missing
      fill across the 14 shipped locales).
    - Every generated artifact is REPRODUCIBLE: regenerate (npm run build and the i18n build)
      and confirm no diff against what is committed (i18n.resolved.generated.ts, the en_XA
      output, i18n.status.json).
    - The CI-equivalent gate is green:
        npm test && npx tsc --noEmit && npm run build:env && npm run build:server && npm run build
    - Bundle size is NOT regressed by en_XA (it is dev-only; production bundle should be
      unchanged or within the established budget). Note the before/after numbers.
    - Copy review: no em dashes and no emojis introduced in any shipped string or doc.
  Record PASS / FAIL per matrix row.

STEP 5 - MARK PACKET COMPLETE
  Update docs/i18n-scaling/progress.md and docs/i18n-scaling/state.md to mark the whole
  packet complete: all 9 phases done (Phase 9 optional, delivered), whole-feature QA verdict
  recorded, deferred follow-ups listed.

STEP 6 - PACKET TEARDOWN (explicit confirmation ONLY)
  FIRST, surface every deferred follow-up to the user in plain language, especially:
    - the list of hard-coded literals that en_XA surfaced (these are real untranslated
      strings still in the codebase, to be fixed in follow-up work), and
    - the OPEN release-fill ownership / API-key item (who owns the 14-locale fill at release
      and how translation is sourced).
  THEN ask the user EXPLICITLY, verbatim:
    "All i18n-scaling phases are complete and green. OK to delete docs/i18n-scaling/ (the
     planning scaffolding) before the PR?"
  RULES for the deletion:
    - Delete ONLY on explicit user confirmation. If the user declines or is silent, LEAVE
      docs/i18n-scaling/ in place and stop.
    - Delete ONLY that one directory, by explicit path. Never `git add -A`, never delete
      anything else.
    - If docs/i18n-scaling/ is already committed:
        git rm -r docs/i18n-scaling/
        then commit:  docs: remove i18n-scaling planning scaffolding
    - If it was never committed:
        rm -rf docs/i18n-scaling/
  Do not remove the doc until the user has actually confirmed.

STEP 7 - FINAL RESPONSE FORMAT
  Report, in this shape:
    - Whole-packet QA verdict: PASS / PASS-WITH-FOLLOWUPS / FAIL.
    - Counts: issues found, issues fixed.
    - Deferred items: the en_XA-surfaced literals (list) and the OPEN release-fill ownership /
      API-key item.
    - Whether the packet scaffolding (docs/i18n-scaling/) was removed.
    - The words: packet complete.

STOPPING RULE
  - Stop and surface immediately if ANY whole-feature invariant in qa-checklist.md fails, or
    if en_XA leaks into any user-facing locale enumeration (supportedLanguages, hreflang, the
    release gate, or the player language picker). Do not proceed to teardown while either is
    true.
```

---

## Why teardown is the last step, and why it is gated

The `docs/i18n-scaling/` directory is planning scaffolding for executing the packet, not
product. Once every phase is complete and green it has served its purpose and would otherwise
add noise to the PR. But removing it is irreversible-feeling to a reviewer mid-flight and may
hold notes the user still wants, so it happens only on an explicit yes, scoped to exactly that
one directory, with an explicit path, and never via `git add -A`. If the user declines, the
scaffolding stays and the packet is still complete. Surfacing the deferred follow-ups before
asking ensures the user is not trading away the record of the en_XA-surfaced literals or the
OPEN release-fill ownership item by agreeing to clean up.
