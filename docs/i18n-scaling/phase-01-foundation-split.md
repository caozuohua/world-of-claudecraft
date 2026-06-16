# Phase 1 - Foundation and monolith split

This phase carves the i18n monolith into a maintainable shape without changing
a single byte of resolved output. We extract the authoritative nested `en`
object and the type machinery into their own module, reduce `src/ui/i18n.ts` to
a thin runtime that keeps every public export name and signature identical, and
split the 13 non-English locale objects into role-seam files that are still
nested and still typed `: typeof en`. We also stand up the byte-equivalence
safety net (a deterministic resolved-table hash script, a committed baseline,
and a test) that every later phase depends on. No flattening, no generated
artifact, no type relaxation happens here.

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
  `performance.now` in `src/sim/`); no new runtime dependency or i18n framework
  (plain TS data plus `.mjs` scripts, sibling to
  `scripts/build_media_manifest.mjs`); generated files are never hand-edited;
  shared worktree, so stage EXPLICIT paths, never `git add -A`.
- The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN,
  zh_TW, ko_KR, ja_JP, pt_BR, ru_RU.
- Byte-equivalence safety net: every behavior-preserving phase is gated by
  SHA-256 byte-equivalence of the resolved 14-locale table. Phase 0 proved this;
  the resolved table is 1,583,881 bytes on main. The cross-phase cheat sheet is
  `docs/i18n-scaling/state.md`; live status is `docs/i18n-scaling/progress.md`.

## Implementation starter prompt

Paste the block below into a fresh Claude Code session to execute Phase 1.

```
This is Phase 1 of the i18n Scaling feature: Foundation and monolith split.

Model: Opus 4.8, max effort, 1m context variant where the file load demands it.
Harness: Claude Code.
ULTRACODE is NOT needed for this phase: it is a careful mechanical split, not a
batch sweep. You may still use parallel Agent fan-out for independent work.

GOAL
Split src/ui/i18n.ts into an authoritative nested en base, a thin runtime, and
per-locale nested data files, all behavior-preserving, and stand up a resolved-
table byte-equivalence safety net, with every public export and every resolved
byte unchanged.

STEP 0 PRE-FLIGHT
- Run `git status`. If the tree is dirty, STOP and ask the user how to proceed:
  this is a shared checkout and you must not absorb someone else's work.
- Scan Claude Code memory: read the MEMORY.md index and these entries:
  shared-worktree-commit-care (stage explicit paths, often commit nothing of
  others'), no-em-dashes-or-emojis (never use either on this project unless
  asked).
- Confirm you are on the i18n refactor branch the packet is using; do not start
  from a stale branch.

STEP 1 LOAD CONTEXT (do NOT read the big files in the main loop)
- The locale files are enormous (i18n.ts is ~13.2k lines; sibling i18n data
  files are hundreds of KB). Reading them in the main loop will blow context.
- Spawn one Explore agent (Agent tool, subagent_type for read-only exploration)
  and have it summarize, NOT dump:
  - docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md (current packet
    state, what Phase 0 delivered).
  - This phase file (docs/i18n-scaling/phase-01-foundation-split.md).
  - The STRUCTURE of src/ui/i18n.ts (not full contents): where the `en` object
    begins and ends; where each of the 13 non-English locale objects begin and
    end; where the content layers are spread in (shellStrings, hudStrings,
    abilityStrings, questStrings, itemStrings, classAbilityNames, itemNames,
    worldNames, and the merge* helpers); where `t`, `tOptional`,
    `hasTranslation`, the internal `translationValue`, the formatters
    (formatNumber, formatMoney, formatDateTime, moneyParts), the language
    getters/setters (getLanguage, setLanguage, isSupportedLanguage), the
    `supportedLanguages` list, and the `TranslationKey`/`Leaves` types live.
  - The i18n invariants in the root CLAUDE.md and src/ui/CLAUDE.md.
- The agent must RETURN: the exact public export list of src/ui/i18n.ts; the
  line ranges of the `en` block and of each locale block; and a description of
  the assembler structure (how locales are spread from the content layers and
  the merge helpers).
- Keep that summary; pass it to any fan-out agent. Do not re-read the big files
  yourself unless a precise edit requires it, and then read only the needed
  range.

STEP 2 CHOOSE ORCHESTRATION + EXECUTE
Two vertical slices. You may run them with parallel Agent fan-out, but you must
request fan-out explicitly and give each agent ONLY the Explore summary plus the
specific range it must touch (never the whole file).

Slice A (extraction):
- Create src/ui/i18n.en.ts holding the authoritative NESTED `en` object plus the
  type machinery: Leaves, TranslationKey, DeepPartial, InterpolationValues. Keep
  en exactly as it is shaped today; do not reorder, dedupe, or normalize keys.
- Reduce src/ui/i18n.ts to the thin runtime: `t`, `tOptional`, `hasTranslation`,
  the internal `translationValue`, the formatters (formatNumber, formatMoney,
  formatDateTime, moneyParts), the language getters/setters (getLanguage,
  setLanguage, isSupportedLanguage), `supportedLanguages`, and re-export the
  types from i18n.en.ts. EVERY public export name and signature stays identical;
  importers must compile unchanged.
- Move the 13 nested non-English locale objects into their own files under a
  clear location (for example src/ui/locales/<code>.ts), still nested and still
  typed `: typeof en`, with NO shape change. The assembled `translations` table
  must remain identical in content and key ordering.

Slice B (safety net):
- Write scripts/i18n_resolved_hash.mjs (zero deps, sibling to
  scripts/build_media_manifest.mjs). It imports/assembles the resolved 14-locale
  `translations` table, serializes it DETERMINISTICALLY with stable recursive
  key ordering, prints the byte length and the SHA-256, and exits non-zero on
  failure. Stable ordering must not depend on object insertion order so the hash
  is reproducible.
- Capture the baseline BEFORE refactoring (see STEP 3); commit it to
  src/ui/i18n.resolved.sha256.
- Add tests/i18n_resolved_equivalence.test.ts that recomputes the resolved-table
  hash the same way the script does and asserts it equals the committed
  baseline.
- Add an `i18n:hash` script to package.json that runs the hash script.

INVARIANTS THIS PHASE MUST KEEP
- en stays NESTED (it drives TranslationKey = Leaves<typeof en>).
- All public exports of src/ui/i18n.ts unchanged in name and signature; verify
  by grepping importers across src/ and confirming they compile.
- No flattening of any locale to dotted keys.
- Behavior-preserving: resolved 14-locale table is byte-identical.
- No Math.random / Date.now / performance.now introduced anywhere in src/sim/.
- No new runtime dependency; the hash script is zero-dep plain .mjs.
- Commit with EXPLICIT paths only; never `git add -A` (shared worktree).

OUT OF SCOPE (do not do any of these here)
- No flattening to dotted keys (that is Phase 3).
- No src/ui/i18n.resolved.generated.ts generated artifact (that is Phase 2).
- No sparse / DeepPartial-typed locales (that is Phase 6).
- No translation registry (that is Phase 5).
- No behavior change to t() miss handling (throw/pending semantics arrive with
  the registry in a later phase).

STEP 3 VALIDATION + REVIEW
- FIRST, before touching anything, run the hash script against the current tree
  to capture the pre-change baseline (confirm it reports 1,583,881 bytes and
  record the SHA-256). This is the byte-equivalence gate value.
- After the split, run:
  - `npx tsc --noEmit`
  - `npx vitest run tests/localization_fixes.test.ts
    tests/localization_coverage.test.ts tests/server_i18n.test.ts
    tests/i18n_resolved_equivalence.test.ts`
  - The byte-equivalence gate: re-run the hash script; the SHA-256 MUST equal
    the pre-change value. If it differs, the split changed resolved output,
    which is a bug, not an acceptable drift.
  - `npm run build` to confirm the client and admin bundles still build.
- Spawn review agents in parallel, each prompted for COVERAGE not filtering
  (report every plausible issue, do not pre-suppress):
  - privacy-security-review (always).
  - cross-platform-sync (the localize seam and the public exports are touched).
  If a review agent starts truncating or stalling, resume it with exactly:
  "Stop reading. Output verdict now."
- Do NOT commit until there are no BLOCKING findings.

STEP 4 COMMIT CADENCE
Three commits, Conventional Commits with scope, explicit paths, no em dashes,
no emojis:
1. refactor(i18n): extract authoritative en base and type machinery
   (src/ui/i18n.en.ts and the trimmed type re-exports).
2. refactor(i18n): reduce i18n.ts to thin runtime and split locale data
   (src/ui/i18n.ts plus the per-locale files).
3. test(i18n): add resolved-table byte-equivalence baseline and gate
   (scripts/i18n_resolved_hash.mjs, src/ui/i18n.resolved.sha256,
   tests/i18n_resolved_equivalence.test.ts, package.json i18n:hash script).

STEP 5 ACCEPTANCE CRITERIA (all must be true)
- [ ] `en` extracted to src/ui/i18n.en.ts and still NESTED.
- [ ] src/ui/i18n.ts is a thin runtime with ALL public exports preserved in name
      and signature.
- [ ] The 13 non-English locales are split into their own files and still nested
      `: typeof en`.
- [ ] scripts/i18n_resolved_hash.mjs, the committed src/ui/i18n.resolved.sha256
      baseline, and tests/i18n_resolved_equivalence.test.ts all exist and pass.
- [ ] The resolved 14-locale table is byte-identical to the pre-change tree
      (same SHA-256, same 1,583,881 bytes).
- [ ] `npx tsc --noEmit`, the four localization test files, and `npm run build`
      are all green.

STEP 6 DOC UPDATES
- Update docs/i18n-scaling/progress.md: mark Phase 1 done with the deliverable
  checklist.
- Update docs/i18n-scaling/state.md: add the per-phase additions log row 1: new
  files src/ui/i18n.en.ts, the per-locale files, src/ui/i18n.resolved.sha256,
  scripts/i18n_resolved_hash.mjs, and the equivalence test; new package.json
  script i18n:hash.
- Record any surprising structure notes (for example unexpected merge-helper
  ordering or duplicate-key quirks discovered during the split) in Claude Code
  memory for later phases.

STEP 7 FINAL RESPONSE FORMAT
Report, in this order:
- Phase status (done / blocked).
- Files touched (explicit paths).
- Validation results (tsc, the four test files, the byte-equivalence gate value,
  build).
- Review verdicts (privacy-security-review, cross-platform-sync).
- Deferred items, if any.
- One-line handoff to Phase 1 QA.

STOPPING RULES
- STOP and surface to the user if byte-equivalence cannot be preserved: a changed
  resolved hash means the split altered output, which is a bug to investigate,
  not a number to re-baseline.
- STOP if any public export must change name or signature: that would ripple to
  ~3,532 call sites and is out of scope for a behavior-preserving split.
```
