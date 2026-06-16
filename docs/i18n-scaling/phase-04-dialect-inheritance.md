# Phase 4 - Dialect inheritance dedup

## Where this sits in the packet

The whole i18n Scaling packet has one shape: an English-only PR passes CI, the
full 14-locale fill lands at release, and there is never a silent English string
shipped to a translated player. The locked decisions that frame every phase are:
(1) a two-tier CI gate (English-complete to merge, all-locales-complete to
release); (2) a dense generated artifact still typed `: typeof en` so `tsc`
keeps catching missing or renamed keys; (3) flat dotted-key overlays for the 13
non-English locales while `en` stays NESTED; (4) a `t()` that throws on an
untracked key in dev but falls back to English for a key that is pending and not
yet release-gated.

The 14 locales are: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN,
zh_TW, ko_KR, ja_JP, pt_BR, ru_RU.

After Phases 1 through 3 the layout is: nested `en` lives in `src/ui/i18n.en.ts`;
each of the 13 non-English locales is a FLAT dotted-key overlay in
`src/ui/i18n.locales/<lang>.ts` (still dense, every key present); and
`scripts/i18n_build.mjs` overlays the flat locale files onto the nested `en` and
emits the dense generated artifact that both the client and the admin SPA
consume. The safety net is a byte-equivalence check: the resolved table is
hashed with SHA-256, the baseline lives in `src/ui/i18n.resolved.sha256`, and
`tests/i18n_resolved_equivalence.test.ts` fails if the resolved output drifts.

Cheat sheet for the packet is `docs/i18n-scaling/state.md`; running status is
`docs/i18n-scaling/progress.md`.

## What this phase does

Make dialect inheritance first-class and uniform. `es_ES` becomes an overlay
over `es` that carries only its genuine divergences; `fr_CA` becomes an overlay
over `fr_FR`; `en_CA` becomes a thin alias of `en`. The resolver applies the
base locale first and then the dialect overlay on top. As part of the same
change, replace the unsafe `{} as WorldEntityTranslations` casts that currently
fake dialect inheritance in `src/ui/world_entity_i18n.ts` with real overlay
semantics. This deletes the duplication called out in the RFC, and it must keep
the resolved table byte-identical: dedup changes the source of the locales, never
the output the client sees.

A grounded fact worth holding onto going in: `src/ui/world_entity_i18n.ts`
ALREADY aliases es_ES to es and fr_CA to fr_FR at module load via
`{} as WorldEntityTranslations` casts, then reassigns the real value later. That
is a compiler bypass that only happens to be safe because of the later
reassignment. The MAIN translation table does NOT alias them at all: es_ES and
fr_CA were hand-authored as full objects there, so roughly 95 percent of their
content is duplicated from the base. en_CA is essentially en.

---

## Implementation starter prompt

```
This is Phase 4 of the i18n Scaling feature: Dialect inheritance dedup.

MODEL: Claude Opus 4.8 (model ID claude-opus-4-8). If you are a different or
weaker model, stop and say so rather than guessing.
HARNESS: Claude Code, shared git worktree. Commit only with EXPLICIT file paths,
never `git add -A` or `git add .`. Other sessions may be working in this tree.
ULTRACODE: not required. This is a focused dedup of three dialect pairs
(es_ES over es, fr_CA over fr_FR, en_CA over en) across two tables. Parallel
Agent fan-out for independent investigation and per-file work is fine and
encouraged, but you do not need maximum-effort mode.

GOAL (one sentence): Make es_ES, fr_CA, and en_CA inherit from a declared base
locale and carry only their real divergences, removing the duplicated dialect
data and the unsafe `{} as` casts, while the dense generated resolved table comes
out byte-identical.

STEP 0 - PRE-FLIGHT
- Confirm the working tree is clean (`git status`). If it is dirty with files you
  do not own, stop and ask; this is a shared worktree.
- Scan your memory / MEMORY.md for any notes relevant to this packet (shared
  worktree commit care, prior i18n decisions). Honor them.
- Record the current HEAD commit so STEP 3 can diff against the phase start.

STEP 1 - LOAD CONTEXT
Launch one Explore agent (read-only) to summarize and report back:
- `docs/i18n-scaling/state.md` and `docs/i18n-scaling/progress.md` (what is
  locked, what Phases 1-3 changed, what is still open).
- This phase file (`docs/i18n-scaling/phase-04-dialect-inheritance.md`).
- The flat overlay structure produced by Phase 3: how a locale file in
  `src/ui/i18n.locales/<lang>.ts` is shaped (flat dotted keys, dense), and how it
  is typed against the leaves of `en`.
- The build-script overlay path in `scripts/i18n_build.mjs`: exactly where and how
  it merges a flat locale onto the nested `en` and emits the generated artifact.
- BOTH tables' handling of the dialects:
  - the MAIN table treatment of es_ES / fr_CA / en_CA (these are hand-authored
    full objects, NOT aliased);
  - `src/ui/world_entity_i18n.ts` AND `src/ui/talent_i18n.ts` treatment of the
    same three dialects, INCLUDING the `{} as WorldEntityTranslations` casts that
    alias es_ES=es and fr_CA=fr_FR at module load before a later reassignment.
The agent must return, concretely: where each dialect's keys live in each table;
which keys GENUINELY diverge from the base versus which are byte-identical
duplicates of the base; and the resolver's current overlay order (base-then-
overlay, or something else). Do not let it modify anything.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE
- Extend the resolver and the build script to support a DECLARED BASE per locale:
  es_ES declares base es, fr_CA declares base fr_FR, en_CA declares base en. The
  resolve order for a dialect becomes: nested en -> base-locale overlay ->
  dialect overlay. Make the base declaration explicit and data-driven (a small
  map or a field on the locale module), not hard-coded branching scattered around.
- Rewrite the es_ES and fr_CA flat overlays to contain ONLY the keys that differ
  from their base. Drop every key whose value equals the base value. Use the
  Explore agent's divergence list, but verify each retained key actually differs;
  do not trust eyeballing.
- Make en_CA a thin alias: an empty or near-empty overlay over en. If en_CA has a
  handful of genuine divergences, keep exactly those; otherwise it is empty.
- Remove the `{} as WorldEntityTranslations` casts in `world_entity_i18n.ts` (and
  any equivalent cast in `talent_i18n.ts`) and replace them with the SAME
  declared-base overlay mechanism, so the compiler bypass is gone entirely. The
  dialect's value in that table should be produced by the resolver applying its
  base then its (now divergence-only) overlay, not by a cast-then-reassign dance.
- The dense generated artifact MUST come out byte-identical: where a dialect
  overlay omits a key, the resolver fills it from the base exactly, which fills
  from en exactly. If a single resolved byte changes, a divergence was
  misclassified.

INVARIANTS - keep all of these:
- Resolved table byte-identical. This is the HARD gate for this phase. Dedup must
  not change a single resolved byte. The SHA-256 in `src/ui/i18n.resolved.sha256`
  stays unchanged and `tests/i18n_resolved_equivalence.test.ts` stays green
  without editing the baseline.
- No `{} as` compiler bypass (or any equivalent cast that fakes a type) remains
  for the dialects.
- `en` stays NESTED. Flat overlays stay typed against the leaves of `en` so a
  renamed or missing key still fails `tsc`.
- Generated artifact is reproducible: regenerate, and `git diff --exit-code` is
  clean.
- No new dependency or framework. sim/server stay language-agnostic; determinism
  untouched. Generated files are never hand-edited.
- Explicit-path commits only.

OUT OF SCOPE (do not touch):
- No sparseness for non-dialect locales (that is Phase 6).
- No locale registry (that is Phase 5).
- No change to t()-miss behavior.
- Do not touch the admin DICT (that is Phase 8).

STEP 3 - VALIDATION + REVIEW
Run, in order, and paste the real output:
- `npx tsc --noEmit` (must be clean; the casts are gone, so the types must hold
  for real now).
- The byte-equivalence gate: regenerate the artifact, then
  `npx vitest run tests/i18n_resolved_equivalence.test.ts`. The resolved-table
  SHA-256 being unchanged is the HEADLINE check for this phase.
- Regenerate the generated artifact and confirm `git diff --exit-code` on it.
- `npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts`.
- `npm run build` (both client and admin entries succeed).
Then launch parallel review agents (COVERAGE oriented, not filtering down to one
finding): `privacy-security-review` and `cross-platform-sync`. If any agent's
output is truncated, resume it and collect the rest before judging. Do not commit
while any BLOCKING finding is open.

STEP 4 - COMMIT CADENCE (2-3 commits, explicit paths)
- `feat(i18n): add declared-base dialect overlay resolution`
- `refactor(i18n): dedup es_ES/fr_CA/en_CA to divergence-only overlays`
- `refactor(i18n): remove unsafe world-entity dialect casts`

STEP 5 - ACCEPTANCE (all must hold)
- es_ES and fr_CA carry ONLY their divergences from the base.
- en_CA is a thin alias of en (empty or near-empty overlay).
- The resolver applies base then dialect overlay, base declared data-driven.
- The `{} as WorldEntityTranslations` casts (and any equivalent) are gone.
- Resolved table byte-identical; baseline SHA-256 unchanged.
- Reproducibility, `tsc`, the test subset, and `npm run build` are all green.

STEP 6 - DOC UPDATES
- `docs/i18n-scaling/progress.md`: tick the Phase 4 checklist.
- `docs/i18n-scaling/state.md`: add row 4 to the additions log; mark the
  `{} as` cast gotcha RESOLVED; record the declared-base dialect mechanism as a
  locked decision.

STEP 7 - FINAL RESPONSE FORMAT
Report back with: STATUS (done / blocked); FILES touched (absolute paths);
VALIDATION (each command and its result); VERDICTS from the review agents;
DEFERRALS (anything punted to a later phase, with the phase number); and a
HANDOFF line pointing at Phase 4 QA (`docs/i18n-scaling/phase-04-qa.md`).

STOPPING RULES
- Stop if dedup changes the resolved output by even one byte. That means a
  divergence was misclassified; find it before continuing.
- Stop if removing a cast forces a type the resolver cannot satisfy. That is a
  signal the overlay mechanism is wrong, not that the type should be loosened.
```
