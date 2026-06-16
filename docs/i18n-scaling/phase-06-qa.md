# Phase 6 QA - Verify the unlock

This is the QA pass for Phase 6 (relax types, t() miss behavior, two-tier CI). The job is to independently re-confirm that each CI gate makes the right decision and that the t() miss behavior matches the locked decision, rather than trusting the implementer's report. The riskiest thing in this phase is a silent English leak to a translated player, so the fallback path gets a mandatory security review.

## Context you need

Locked decisions: (1) two-tier CI gate (PR vs release); (2) the dense generated artifact `src/ui/i18n.resolved.generated.ts` typed `: typeof en` keeps tsc safety; (3) flat dotted-key overlays for the 13 non-English locales, `en` nested; (4) `t()` throws on untracked keys in dev/test, renders English for registry-`pending` keys on non-release builds only, and release builds require an empty `pending` set.

The four gate cases that must hold:
- An untracked key (referenced but not in the registry) THROWS in dev/test.
- A `pending` key renders English on NON-RELEASE builds only.
- A `pending` key BLOCKS the release gate (empty-pending assertion + t() hard fail on release).
- A key that is neither translated nor registered FAILS the PR gate.

The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU. Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.

Invariants: sim/server stay language-agnostic; determinism untouched; no new dependency or framework; generated files never hand-edited; shared worktree so explicit-path commits only.

---

## QA starter prompt

Paste the fenced block below into a fresh Claude Code session.

```
This is Phase 6 QA of the i18n Scaling feature: Verify the unlock.

MODEL: Opus 4.8 (model ID claude-opus-4-8). If you are not that model, drop to the Sonnet baseline: fewer parallel agents, smaller verification steps.

HARNESS: ultracode recommended. The point of this QA is an adversarial-verify Workflow that INDEPENDENTLY re-confirms each gate decision: build the pass-cases and fail-cases yourself, run each gate, and check that every case lands where the locked decision says it should. Do not accept the implementer's claim that a gate works; reproduce it.

STEP 0 - PRE-FLIGHT
- Confirm git is clean (or only your own files staged). Shared worktree: explicit-path commits only.
- NOTE: the resolved-table byte-equivalence baseline (`src/ui/i18n.resolved.sha256`) changed in Phase 6 because pending keys now English-fill deterministically. Confirm the change was INTENDED: the hash update should be in a commit whose message explains it, and state.md row 6 should record why. If the hash moved without that paper trail, flag it.

STEP 1 - LOAD CONTEXT
Launch one Explore agent (read-only). Have it summarize:
- state.md, progress.md, and phase-06-unlock-two-tier.md.
- The git diff since the start of Phase 6 (find the phase-start point and diff to HEAD).
- The current `.github/workflows/ci.yml` and how it is split by ref.
The agent reports: the t() miss path as implemented, the release-flag mechanism chosen, where `s3_registered` and `s3_localized` now live, and which steps each CI tier runs.

STEP 2 - PARALLEL QA AGENTS
Run these as parallel agents. Every agent is COVERAGE, not filtering: report everything in your lane, do not pre-judge severity away. Use truncation-resume if any agent returns truncated.

1. Correctness agent - RE-PROVE all four gate cases, independently:
   - An untracked key THROWS in dev/test (construct one; observe the throw).
   - A `pending` key renders English on NON-RELEASE builds only (and does NOT on release).
   - A `pending` key BLOCKS the release gate.
   - A key that is neither translated nor registered FAILS the PR gate.
   Also verify: tsc English-completeness is STILL enforced via the dense artifact's `: typeof en` typing (remove an English key in a scratch check and confirm tsc fails, then restore); and the copied-English rendered-content checks REALLY moved to the release tier, i.e. the PR run SKIPS them and the release run INCLUDES them (run both tiers locally with the right ref/env and diff the executed test sets).

2. Test-coverage agent - confirm the tests DIRECTLY ASSERT the gate behavior, not merely that the code runs without error. Specifically:
   - There is a test asserting an untracked key throws.
   - There is a test asserting pending renders English on non-release and not on release.
   - There is a test asserting an unregistered, untranslated key fails the PR gate.
   - ADD a test that a release build with a NON-EMPTY pending set FAILS (this is the load-bearing release guarantee and must be asserted, not assumed).

3. Dead-code / cleanup agent - no leftover dense-only typing on the non-English overlays; no stray `?? 'English'` or any English-fallback path in the release branch; no unused imports or dead sample/scaffolding keys left from the implementer's gate proofs.

4. privacy-security-review (MANDATORY this phase) - the English-fallback path is safety-sensitive. Confirm English cannot leak to a translated player on ANY release path, and that the release-flag detection cannot be silently wrong (e.g. unset env defaulting to non-release in a deployed build).

5. cross-platform-sync - the S3 split touches matcher coverage. Confirm sim/server emits still resolve at the client boundary under both `s3_registered` (PR) and `s3_localized` (release).

6. qa-checklist - generate and run the Phase 6 checklist (determinism, three-host / IWorld parity, i18n, build gate) against the diff.

STEP 3 - FIX + RE-RUN
- Fix any BLOCKING findings yourself (this is a QA-and-repair pass, not review-only).
- Re-run the FULL validation matrix after fixing: `npx tsc --noEmit`; all four gate cases; the new non-empty-pending-fails-release test; the full localization suite at the release tier; confirm the PR tier skips the content checks and the release tier runs them.
- Commit fixes as SEPARATE commits with explicit paths and Conventional Commit messages (`fix(i18n): ...` / `test(i18n): ...`). Do not fold fixes into one giant commit.

STEP 4 - DOC UPDATES
- progress.md: mark Phase 6 QA done with any caveats.
- state.md: if QA changed anything material (release flag handling, gate contents, the baseline rationale), update row 6 to match reality.

STEP 5 - TEARDOWN
- Skip packet teardown (this is not the final phase).

STEP 6 - VERDICT + HANDOFF
- Give a clear verdict: PASS / PASS WITH FIXES (list them) / FAIL (list blocking issues).
- Restate the four gate cases with their observed results.
- One-line handoff to Phase 7.

STOPPING RULE - stop and surface to the user if:
- Any of the four gate cases cannot be made to behave correctly.
- Pending-English could reach a real user (any release path that renders English instead of failing).
```
