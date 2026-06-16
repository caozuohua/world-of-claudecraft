# Phase 3 QA: Verify flattened non-English locales

QA pass for Phase 3. Confirm that all 13 non-English locales (main table and the island files) are now flat dotted-key overlays, that `en` is still nested and authoritative, and that the resolved table is byte-identical to before. The whole-packet goal is unchanged: English-only PR passes CI, full 14-locale fill at release, no silent English.

---

## QA starter prompt

Paste everything below into a fresh Claude Code session.

```
This is Phase 3 QA of the i18n Scaling feature: Verify flattened non-English locales.

MODEL: Use Opus 4.8 (claude-opus-4-8). If the identity line is stale, fall back to the baseline working style; never gate an invariant on the model.
HARNESS: Claude Code, single shared worktree. Other sessions may touch this tree. Stage and commit by EXPLICIT path only.

ULTRACODE: Optional this pass. Use it for an adversarial-verify Workflow that re-checks each of the 13 locales resolves identically (one work item per locale: unflatten the overlay, overlay on nested `en`, diff against the resolved slice). Otherwise a manual fan-out is fine.

---

STEP 0 - PRE-FLIGHT
- `git status`. Identify the Phase 3 changes; leave unrelated changes from other sessions alone.
- Scan auto-memory for this project (shared-worktree commit care, no em dashes or emojis). Honor it.

STEP 1 - LOAD CONTEXT
Spawn one Explore agent to summarize and return:
- `docs/i18n-scaling/state.md`, `docs/i18n-scaling/progress.md`, the implementation phase file `docs/i18n-scaling/phase-03-flatten-overlays.md`.
- The git diff since the phase start (what changed: new `src/ui/i18n.locales/<lang>.ts`, touched islands `src/ui/world_entity_i18n.ts` and `src/ui/talent_i18n.ts`, the updated `scripts/i18n_build.mjs`, the generated artifact, the temporary key-completeness test).
The agent returns a concise change inventory plus anything that looks off.

STEP 2 - PARALLEL QA AGENTS (COVERAGE mode: each reviews the whole diff; do NOT split the diff)
Spawn in parallel:
- Correctness: every non-English locale (main + islands) is actually flattened; every flat key is an exact member of `Leaves<typeof en>` (no extra, no typo'd, no missing-as-dense); each locale resolves byte-identical to the pre-phase artifact; the islands are handled including the existing es_ES -> es and fr_CA -> fr_FR aliasing; `en` is still nested.
- Test-coverage: the key-completeness test and the flatten round-trip are meaningful (they would actually fail if a key were dropped or mistyped). ADD a test that a typo'd dotted key (one not in `Leaves<typeof en>`) is rejected by tsc or a test. Confirm byte-equivalence (`tests/i18n_resolved_equivalence.test.ts`) and reproducibility are exercised.
- Dead-code / cleanup: the old nested locale objects are FULLY removed (no orphan exports, no dangling imports), no duplicate locale data left behind, the build script has no leftover nested-locale code path.
Also run: `privacy-security-review`, `cross-platform-sync`, `qa-checklist`.
COVERAGE not filtering. If any review truncates, resume it. Collect all findings with BLOCKING / non-blocking severity.

STEP 3 - FIX + RE-RUN VALIDATION
For each BLOCKING finding, fix it, then re-run:
- `npx tsc --noEmit`
- regenerate + `git diff --exit-code` on `src/ui/i18n.resolved.generated.ts`
- `scripts/i18n_resolved_hash.mjs` vs `src/ui/i18n.resolved.sha256`
- `npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts`
- the new typo'd-key-rejection test
- `npm run build`
Commit fixes in SEPARATE commits by explicit path, e.g. `test(i18n): reject dotted keys not in Leaves(en)` and `fix(i18n): <specific fix>`.

STEP 4 - UPDATE DOCS (explicit paths)
- `docs/i18n-scaling/progress.md`: mark Phase 3 QA complete.
- `docs/i18n-scaling/state.md`: note any QA-driven corrections.

STEP 5 - TEARDOWN
Skip packet teardown (this is not the final phase).

STEP 6 - VERDICT + HANDOFF
Report: PASS / FAIL with the evidence (tsc, byte-equivalence SHA, reproducibility diff, named tests, build). List residual non-blocking notes. Hand off to Phase 4 (dialect dedup: drop es_ES / fr_CA shared keys).

STOPPING RULE
- Stop if byte-equivalence cannot be made green. A non-identical resolved table means a flatten dropped, duplicated, or altered a value, and that must be resolved before Phase 4.
```
