# Phase 3: Flatten the non-English locales to dotted-key overlays

Convert the 13 non-English locale objects (in the main `translations` table and in the island files that carry per-locale data) from nested `: typeof en` objects into FLAT dotted-key maps. `en` stays nested and authoritative. At the end of this phase the overlays are still DENSE (every key present, just flat), so the resolved table stays byte-identical; sparseness comes later (Phase 6). The build script is updated to read flat overlays plus nested `en` and produce the identical dense artifact.

This is a uniform batch sweep across 13 locales times several files, so it is a Workflow candidate. The whole-packet goal is unchanged: an English-only PR passes CI, the full 14-locale fill lands at release, and there is no silent English in between.

---

## Implementation starter prompt

Paste everything below into a fresh Claude Code session.

```
This is Phase 3 of the i18n Scaling feature: Flatten the non-English locales to dotted-key overlays.

MODEL: Use Opus 4.8 (claude-opus-4-8). If the identity line is stale, fall back to the baseline working style and do not gate any invariant on the model.
HARNESS: Claude Code, single shared worktree. Other sessions may touch this tree. Stage and commit by EXPLICIT path only. Never `git add -A` or `git add .`.

ULTRACODE: Add the keyword `ultracode` to this phase. This is a uniform batch sweep over 13 locales across multiple files (main table plus the two island files), which is exactly the shape that pays off under high effort. Orchestrate via a Workflow rather than hand-spawning agents: pipeline one locale-file per work item, where each item runs flatten -> regenerate -> verify byte-equivalence of that locale's slice, and adversarially verify the conversion resolves identically before the item is accepted. Cap manual fan-out at about 5 parallel agents; past that, use the Workflow.

GOAL: Convert all 13 non-English locales (in the main table and the island files) from nested `: typeof en` objects into flat dotted-key maps, update the build script to overlay them onto nested `en`, and emit the byte-identical dense `src/ui/i18n.resolved.generated.ts`.

---

STEP 0 - PRE-FLIGHT
- Confirm the working tree is clean for the files you will touch (`git status`). If other sessions left unrelated changes, leave them; you commit by explicit path only.
- Scan your auto-memory (MEMORY.md and linked notes) for this project: shared-worktree commit care, no em dashes or emojis, instruction-files policy. Honor them.
- Read `docs/i18n-scaling/state.md` (cheat sheet) and `docs/i18n-scaling/progress.md` (status) before doing anything else.

STEP 1 - LOAD CONTEXT
Spawn one Explore agent. Have it summarize and return, not dump files:
- `docs/i18n-scaling/state.md`, `docs/i18n-scaling/progress.md`, and this phase file.
- The Phase 1-2 output: `src/ui/i18n.en.ts` (nested authoritative `en`), the nested per-locale files, `scripts/i18n_build.mjs`, and the generated artifact `src/ui/i18n.resolved.generated.ts`.
- The exact nested shape of one representative non-English locale (pick one, e.g. es), and the per-locale structures inside the island files `src/ui/world_entity_i18n.ts` (~260KB; note es_ES and fr_CA are already aliased to es and fr_FR there) and `src/ui/talent_i18n.ts` (~187KB).
The agent must return three things precisely:
  1. The exact nested shape (depth, whether any value is itself an object that is a real leaf vs a nesting node, any function-valued entries, any arrays).
  2. The full dotted-key set derivable from `en` (i.e. `Leaves<typeof en>`), or the rule that produces it.
  3. The flatten/unflatten contract the build script needs (how `{a:{b:"x"}}` maps to `{"a.b":"x"}` and back, and how the build reconstructs the dense nested object to overlay).

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE
First define the flatten contract, in writing, before converting anything:
- A nested `{a:{b:"x"}}` becomes the flat `{"a.b":"x"}`. The separator is a literal dot.
- Every dotted key MUST exactly match a path in `Leaves<typeof en>`. A dotted key that is not a real `en` leaf is a bug and must fail tsc or a test.
- Leaves carry the same value (string, or function/ICU-shaped value if `en` has them) the nested form carried. Do not change values this phase.

Then choose orchestration. With 13 locales across 3 files (main table, world_entity, talent) the count exceeds the manual fan-out cap, so use a Workflow. One work item per locale-file. Each item:
- Converts that locale to a flat dotted-key map. Main-table locales go to `src/ui/i18n.locales/<lang>.ts`, each exporting a flat dotted-key record. Type the overlay for now as a dense record of ALL `TranslationKey`s (e.g. `Record<TranslationKey, string>` or the equivalent the build expects); sparse / DeepPartial typing waits for Phase 6.
- Applies the same flattening to the island files' non-English locale data (`world_entity_i18n.ts`, `talent_i18n.ts`), keeping the es_ES -> es and fr_CA -> fr_FR aliasing those islands already have. Do not introduce dialect dedup here; that is Phase 4.
- Regenerates via the build and verifies that locale's slice of `src/ui/i18n.resolved.generated.ts` is byte-identical to the pre-phase artifact.

Update `scripts/i18n_build.mjs` to: read the flat overlays plus nested `en`, unflatten each overlay, overlay it onto `en`, and emit the SAME dense `src/ui/i18n.resolved.generated.ts` (still `: typeof en`). Keep `en` nested everywhere; it remains the authoritative source that drives `TranslationKey = Leaves<typeof en>` and the ~3,532 call sites.

Each Workflow item MUST verify its locale resolves byte-identical before being accepted. An item that cannot reach byte-identical is a stop condition (see STOPPING RULES), not something to paper over.

INVARIANTS (do not break):
- `en` stays nested and authoritative.
- Flat keys are an exact subset of `Leaves<typeof en>`. A typo'd dotted key must fail tsc or a test.
- Overlays are still DENSE this phase (every key present in every locale).
- The resolved table is byte-identical to the pre-phase artifact (resolved-table SHA-256 unchanged against baseline `src/ui/i18n.resolved.sha256`).
- The generated artifact is reproducible (regenerate -> `git diff --exit-code`).
- sim/server stay language-agnostic; determinism untouched.
- No new dependency, no new framework.
- Never hand-edit the generated file; only the build writes it.
- Commit by explicit path only.

OUT OF SCOPE (later phases):
- No dialect dedup yet (Phase 4 drops es_ES/fr_CA shared keys).
- No sparseness / DeepPartial typing (Phase 6).
- No registry (Phase 5).
- No change to t() miss behavior (throw-on-untracked-in-dev / English-for-pending-non-release).

STEP 3 - VALIDATION + REVIEW
Run in order; do not commit until clean and no BLOCKING findings:
- `npx tsc --noEmit`
- Regenerate the artifact, then `git diff --exit-code` on `src/ui/i18n.resolved.generated.ts` (reproducibility).
- Byte-equivalence gate: run `scripts/i18n_resolved_hash.mjs` and confirm the SHA-256 matches `src/ui/i18n.resolved.sha256`; `npx vitest run tests/i18n_resolved_equivalence.test.ts`.
- Add a TEMPORARY key-completeness test asserting every flat overlay contains every `TranslationKey` (overlays are still dense this phase). Run it.
- `npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts`
- `npm run build`
Then spawn parallel review agents in COVERAGE mode (each reviews the whole diff; do NOT split the diff between them): `privacy-security-review`, `cross-platform-sync`. If a review is truncated, resume it. No commit until there are no BLOCKING findings.

STEP 4 - COMMIT CADENCE (explicit paths only; suggest 2-4 commits)
- `refactor(i18n): define flatten contract and build-script overlay path`
- `refactor(i18n): flatten main-table non-English locales to dotted-key overlays`
- `refactor(i18n): flatten world-entity and talent island locales`
- `test(i18n): assert flat overlays match Leaves(en) and stay dense`

STEP 5 - ACCEPTANCE
- All 13 non-English locales (main table plus islands) are flat dotted-key maps; main-table ones live under `src/ui/i18n.locales/<lang>.ts`.
- `en` is still nested and authoritative.
- The build script resolves flat overlays + nested `en` into the byte-identical dense artifact.
- Key-completeness (dense), reproducibility (`git diff --exit-code`), and byte-equivalence (SHA-256 unchanged) are all green.
- `npx tsc --noEmit`, the named test suite, and `npm run build` are all green.

STEP 6 - DOC UPDATES (explicit paths)
- `docs/i18n-scaling/progress.md`: tick the Phase 3 checklist.
- `docs/i18n-scaling/state.md`: append additions-log row 3 noting the new files `src/ui/i18n.locales/<lang>.ts` and that the island files (`world_entity_i18n.ts`, `talent_i18n.ts`) are flattened too.

STEP 7 - FINAL RESPONSE FORMAT
Report back, skimmable:
- STATUS: done / blocked.
- FILES: the new `src/ui/i18n.locales/<lang>.ts` files, the touched islands, the updated build script, the temporary test, docs.
- VALIDATION: tsc / each test / build / byte-equivalence / reproducibility results.
- REVIEW VERDICTS: privacy-security-review and cross-platform-sync, with any BLOCKING resolved.
- DEFERRALS: anything punted to Phases 4, 5, 6.
- HANDOFF: point to phase-03-qa.md for verification.

STOPPING RULES
- Stop if any locale cannot be flattened to resolve byte-identical. That indicates a key mismatch or a value that depended on nested structure; surface it, do not work around it.
- Stop if a flat key does not correspond to a real `Leaves<typeof en>` path.
```
