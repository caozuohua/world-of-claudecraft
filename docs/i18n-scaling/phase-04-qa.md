# Phase 4 QA - Verify dialect inheritance dedup

## Context

This QA pass verifies the work from
`docs/i18n-scaling/phase-04-dialect-inheritance.md`. That phase made dialect
inheritance first-class: es_ES became a divergence-only overlay over es, fr_CA a
divergence-only overlay over fr_FR, en_CA a thin alias of en; the resolver and
build script gained a declared-base mechanism; and the unsafe
`{} as WorldEntityTranslations` casts were removed. The packet-wide goal is
unchanged: English-only PR passes CI, full 14-locale fill at release, no silent
English. The hard invariant for Phase 4 is that the resolved table stays
byte-identical, guarded by the SHA-256 baseline in `src/ui/i18n.resolved.sha256`
and `tests/i18n_resolved_equivalence.test.ts`.

The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW,
ko_KR, ja_JP, pt_BR, ru_RU. `en` is nested; the 13 others are flat dotted-key
overlays; the dialects now declare a base.

---

## QA starter prompt

```
This is Phase 4 QA of the i18n Scaling feature: Verify dialect inheritance dedup.

MODEL: Claude Opus 4.8 (model ID claude-opus-4-8). If you are a different or
weaker model, stop and say so.
HARNESS: Claude Code, shared git worktree. Commit only with EXPLICIT file paths.
Other sessions may be working in this tree.

STEP 0 - PRE-FLIGHT
- `git status` to see the state of the tree; note anything you do not own.
- Confirm the Phase 4 implementation commits are present in history.
- Scan memory / MEMORY.md for packet notes (shared-worktree commit care, locked
  decisions) and honor them.

STEP 1 - LOAD CONTEXT
Launch one Explore agent (read-only) to summarize:
- `docs/i18n-scaling/state.md`, `docs/i18n-scaling/progress.md`, and
  `docs/i18n-scaling/phase-04-dialect-inheritance.md`.
- The git diff since the phase start (the Phase 4 commits): which files changed,
  and how the dialect overlays and the two tables now look.
The agent returns the concrete before/after so the QA agents below have a map.
Do not let it modify anything.

STEP 2 - PARALLEL QA AGENTS (fan out; COVERAGE oriented, not filtering)
Run these concurrently. Each must aim for full coverage of its lane, not a single
top finding. If any agent's output truncates, resume it and gather the rest.

1) Correctness:
   - es_ES and fr_CA overlays contain ONLY genuine divergences (no key equal to
     its base survives), and they resolve byte-identical to the pre-dedup output.
   - en_CA aliases en (empty or near-empty overlay; any retained key is a real
     divergence).
   - Resolver order is correct: nested en -> base-locale overlay -> dialect
     overlay, with the base declared data-driven (not scattered branching).
   - ALL `{} as WorldEntityTranslations` casts are removed from
     `world_entity_i18n.ts` (and any equivalent cast in `talent_i18n.ts`), and NO
     new compiler bypass (cast, `any`, `@ts-ignore`, `!` assertion fudge) was
     introduced in their place.

2) Test-coverage:
   - There is a test that proves a dialect overlay key actually OVERRIDES the
     base value (es_ES diverging from es is observable in the resolved table).
   - There is a test that proves OMITTING a key in the dialect overlay falls back
     to the base value, not to en directly when the base itself diverges from en.
   - The byte-equivalence test (`tests/i18n_resolved_equivalence.test.ts`) still
     guards the resolved table and was not weakened or its baseline silently
     rewritten.

3) Dead-code / cleanup:
   - No duplicated dialect data remains anywhere (the ~95 percent that used to be
     copied from the base is gone).
   - No unused casts, helper types, or now-orphaned objects left behind from the
     old hand-authored full-object dialects.

Also run the standard review agents in parallel: `privacy-security-review`,
`cross-platform-sync`, and `qa-checklist`.

STEP 3 - FIX + RE-RUN VALIDATION
For each BLOCKING finding, fix it, then re-run:
- `npx tsc --noEmit`
- regenerate the artifact + `git diff --exit-code` on it
- `npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts`
- `npm run build`
Land fixes as SEPARATE commits with explicit paths and Conventional Commit
messages (for example `fix(i18n): ...` or `test(i18n): ...`). Do not fold QA
fixes into the Phase 4 implementation commits.

STEP 4 - DOC UPDATES
- `docs/i18n-scaling/progress.md`: mark Phase 4 QA done.
- `docs/i18n-scaling/state.md`: note any gotcha found and resolved during QA.

STEP 5 - TEARDOWN
Skip packet teardown (this is not the final phase).

STEP 6 - VERDICT + HANDOFF
Report: overall PASS / FAIL; per-lane findings and their resolution; the final
validation output; and a HANDOFF line pointing at Phase 5 (the locale registry).

STOPPING RULE
- Stop if the byte-equivalence test cannot be made green. A drifted resolved
  table means a divergence was misclassified or the resolver order is wrong;
  surface it rather than rewriting the SHA-256 baseline.
```
