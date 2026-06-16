# Phase 6 - The unlock (relax types, t() miss behavior, two-tier CI)

This is the commit where English-only PRs become legal. We relax the flat non-English overlays from dense to sparse (`Partial<Record<TranslationKey,string>>`), change `t()` so a miss throws for an untracked key in dev/test and renders English only for a registry-`pending` key and only on non-release builds, and split CI by git ref into a cheap PR gate and a full release gate. We also split the S3 guard into `s3_registered` (PR-time) and `s3_localized` (release-time), and move the copied-English rendered-content checks to the release tier. The non-negotiable invariant must hold at both tiers: a key that is neither translated nor registered fails the PR gate, and a merely `pending` key cannot survive to a cut release. This is the riskiest phase in the packet; treat the gate behavior as load-bearing and verify it directly. It is also the first phase where the resolved-table byte-equivalence baseline is allowed to change, because `pending` keys now English-fill deterministically, so the runner must update `src/ui/i18n.resolved.sha256` deliberately and have QA confirm the change is intended.

## Where this sits in the packet

Whole-packet goal: an English-only PR compiles and passes CI; the full 14-locale fill happens once at release; no English is ever silently shipped to a translated player. Locked decisions in play here: (1) two-tier CI gate (PR vs release); (2) the dense generated artifact `src/ui/i18n.resolved.generated.ts` typed `: typeof en` keeps tsc safety; (3) flat dotted-key overlays for the 13 non-English locales, `en` nested; (4) `t()` throws on untracked keys in dev/test and renders English for registry-`pending` keys on non-release builds only, while release builds require an empty `pending` set.

After Phases 1 to 5 the data and tooling exist and everything is still DENSE: nested `en` (`src/ui/i18n.en.ts`); flat dotted-key overlays (`src/ui/i18n.locales/<lang>.ts`); the dense generated artifact (`src/ui/i18n.resolved.generated.ts`) consumed by client and admin; the registry (`src/ui/i18n.status.json`) plus scanner (`scripts/i18n_scan.mjs`) with `srcHash`; `COPIED_ALLOW` and `ALLOW_V07_SLASH` are registry views. The S3 drift guard lives in `tests/localization_fixes.test.ts` and scrapes `sim.ts`/`hud.ts` source (de_DE-only today). Copied-English rendered-content checks live in `tests/localization_coverage.test.ts` (quest/talent) plus the H3b check in `localization_fixes.test.ts`. CI is one `build` job in `.github/workflows/ci.yml` running on pull_request and push to main, dev-*, and release/**.

The 14 locales: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU. `Object.keys(translations)` / `supportedLanguages` is the authoritative locale set; never author against a printed list.

Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.

---

## Implementation starter prompt

Paste everything in the fenced block below into a fresh Claude Code session.

```
This is Phase 6 of the i18n Scaling feature: The unlock (relax types, t() miss behavior, two-tier CI).

MODEL: Opus 4.8 (model ID claude-opus-4-8). If you are not that model, drop to the Sonnet baseline: smaller steps, checkpoint before multi-file edits, single investigation subagent.

HARNESS: Add ultracode for this phase. Verifying the two-tier gate requires exercising many sample keys (English-only, pending, blocked, untracked) across both the PR tier and the release tier, and the gate behavior is the whole point of the phase. Orchestrate an adversarial-verify Workflow: for each gate, construct sample cases that SHOULD pass and sample cases that SHOULD fail, run the gate, and confirm each case lands on the expected side. Cap manual subagent fan-out at about 5; lean on the Workflow for the matrix.

GOAL: Make English-only PRs legal by relaxing the non-English overlay types to sparse partial maps, changing t() miss behavior (throw on untracked in dev/test, English for pending on non-release only, hard fail for pending on release), and splitting CI into a cheap PR gate and a full release gate, all while preserving the invariant that an unregistered key fails the PR gate and a pending key cannot reach a cut release.

STEP 0 - PRE-FLIGHT
- Confirm git is clean (or only your own files are staged). This is a shared worktree; stage and commit EXPLICIT paths only, never `git add -A` / `git add .`.
- Scan your memory and docs/i18n-scaling/state.md and progress.md so you do not redo earlier-phase work.
- IMPORTANT: this phase DELIBERATELY changes runtime behavior, so the resolved-table byte-equivalence baseline (`src/ui/i18n.resolved.sha256`) WILL move. That is expected here and only here so far. Do not treat the moved hash as a regression; you will update it intentionally in STEP 3.

STEP 1 - LOAD CONTEXT
Launch one Explore agent (read-only). Have it summarize and report back:
- The key points of state.md, progress.md, and this phase file (phase-06-unlock-two-tier.md).
- The current t() implementation: where the miss path is, what it returns today on a miss, and how a key is looked up.
- The current overlay typing: how the flat non-English overlays are typed today (the dense form) and where the dense generated artifact `src/ui/i18n.resolved.generated.ts` gets its `: typeof en` completeness guarantee.
- The registry shape (`src/ui/i18n.status.json`): what a `pending` entry looks like, how `COPIED_ALLOW` / `ALLOW_V07_SLASH` are derived as registry views, and how the scanner (`scripts/i18n_scan.mjs`) writes `srcHash`.
- The S3 guard structure in `tests/localization_fixes.test.ts`: how it scrapes `sim.ts`/`hud.ts` source, that it is de_DE-only today, and where H3b lives.
- The copied-English rendered-content checks in `tests/localization_coverage.test.ts` (quest/talent).
- The single CI `build` job in `.github/workflows/ci.yml`: its triggers (pull_request and push to main/dev-*/release/**) and its exact steps.
The agent MUST return, as concrete findings: (a) the exact t() miss code path; (b) how release-vs-non-release can be detected at build time here (an env var, NODE_ENV, or a dedicated release flag) and what is already available; (c) the S3 guard's structure and how to split it without losing source scraping; (d) the CI job's steps verbatim so they can be partitioned across two tiers.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE
Three vertical slices. You may run the investigation parts of slices in parallel, but land them as separate commits (see cadence). Do NOT depopulate any locale; leave them full. This phase only makes sparseness LEGAL and proves the gates with sample keys.

Slice A - types + t()
- Relax the flat non-English overlays to `Partial<Record<TranslationKey,string>>` so a sparse overlay is legal. The dense generated artifact `src/ui/i18n.resolved.generated.ts` STILL keeps its `: typeof en` typing, so English-completeness stays tsc-enforced through the dense artifact even though the source overlays are now allowed to be sparse.
- Change t() so that on a miss it:
  (a) THROWS if the key is untracked in the registry, when running in dev/test;
  (b) renders the English value for a registry-`pending` key, only on a non-release build;
  (c) on a release build, a `pending` key is a HARD FAILURE (the release gate guarantees the pending set is empty, so in practice this never fires, but it must be wired so that if it ever did, the build/render fails loudly rather than silently shipping English).
- Define the release flag EXPLICITLY (pick the mechanism the Explore agent found to be reliable here, e.g. a single env var read once at module load). Document in code and in state.md that a non-release build carrying pending keys must NEVER be deployed.

Slice B - CI split
- Split `.github/workflows/ci.yml` by git ref using `if: github.ref` (or equivalent ref/event conditions). Two gates:
  - PR gate (runs on pull_request and pushes that are not release/**): tsc against the dense artifact; registry-in-sync (scanner srcHash matches); `s3_registered`; placeholder parity for the translations that actually exist.
  - Release gate (runs on `release/**`): 14-locale key parity (the H3 check); copied-English rendered-content checks; `s3_localized` across all 14 locales; and an empty-`pending` assertion.
- Keep it ONE workflow file with ref-conditioned steps/jobs (no new dependency, no new framework). Make the condition explicit and readable.

Slice C - test re-homing
- Split the S3 guard into `s3_registered` (PR) and `s3_localized` (release), preserving the source-scraping approach against `sim.ts`/`hud.ts`. `s3_registered` asserts: every emitted player string maps to a key OR a RULE that has an English row (registered). `s3_localized` asserts the same coverage across all 14 locales.
- Move the copied-English rendered-content checks (`localization_coverage.test.ts` quest/talent, plus H3b in `localization_fixes.test.ts`) to RELEASE-tier-only execution. Tag or gate them so the PR run SKIPS them and the release run INCLUDES them (an env-driven `describe.skipIf` / test tag is fine; no new dep).

INVARIANTS - YOU MUST keep these
- PR tier: a key that is neither translated nor in the registry MUST fail.
- Release tier: a merely `pending` key MUST block (empty-pending assertion + t() hard fail on release).
- English-completeness stays tsc-enforced via the dense artifact's `: typeof en` typing.
- The t() English-for-pending relaxation is scoped to NON-RELEASE builds ONLY.
- No `?? 'English'` style fallback in release builds. The only English-rendering path is the non-release pending path; everywhere else a real translation or a hard failure.
- sim/server stay language-agnostic; determinism untouched; no new dependency or framework; generated files are never hand-edited (regenerate); explicit-path commits on the shared worktree.

OUT OF SCOPE (later phases)
- No worklist tooling (Phase 7). No admin migration (Phase 8). No pseudo-locale (Phase 9).
- Do NOT actually depopulate locales. Leave them full. Just make sparseness LEGAL and prove the gates with sample keys.

STEP 3 - VALIDATION + REVIEW
- `npx tsc --noEmit` is green.
- PROVE THE GATE directly (this is the load-bearing verification):
  1. Add a deliberately English-only sample key (registered as `pending`). Confirm it PASSES the PR gate, and that a non-release build renders English for it.
  2. Confirm a deliberately incomplete locale (drop a translation for an existing key in one overlay) FAILS the release gate.
  3. Confirm an UNTRACKED key (referenced but absent from the registry) THROWS in dev/test.
  4. Confirm the same untracked key would FAIL the PR gate (neither translated nor registered).
  5. Confirm a `pending` key on a release build is a hard failure (and that the empty-pending assertion would block it).
  Then REMOVE all the samples. The samples are proof scaffolding, not shipped code.
- Run the full localization suite at the release tier and confirm green.
- Update `src/ui/i18n.resolved.sha256` to the new intended baseline (because pending keys now English-fill deterministically). Explain the change in the commit message that touches the hash.
- Parallel review agents (COVERAGE, not filtering; pass them the full diff and have them report everything in their lane):
  - `privacy-security-review`: the English-fallback path is a safety-sensitive change; confirm English cannot leak to a translated player on any release path.
  - `cross-platform-sync`: the S3 split touches matcher coverage; confirm sim/server emits still resolve at the client boundary across both tiers.
  Use truncation-resume if a review returns truncated. Do NOT commit while any BLOCKING finding stands.

STEP 4 - COMMIT CADENCE (3 to 4 commits, EXPLICIT paths)
1. `feat(i18n): relax non-English overlays to sparse partial maps`
2. `feat(i18n): throw on untracked keys; render English for pending on non-release only`
3. `ci(i18n): split CI into PR and release gates by ref`
4. `test(i18n): split S3 into s3_registered/s3_localized and move content checks to release`
(The `src/ui/i18n.resolved.sha256` update goes in the commit whose behavior moves it, with the why in the message.)

STEP 5 - ACCEPTANCE
- Overlays may be sparse and still compile.
- t() miss behavior matches the locked decision: throw on untracked in dev/test; English for pending on non-release; never pending on release.
- CI split by ref verified (PR gate vs release gate steps land on the right tier).
- S3 split done (`s3_registered` PR, `s3_localized` release).
- Content checks are release-only (PR run skips them, release run includes them).
- An English-only sample PR passes the PR gate; an incomplete locale fails the release gate.
- Baseline hash updated intentionally with a recorded reason.

STEP 6 - DOC UPDATES
- progress.md: tick the Phase 6 checklist.
- state.md: add the additions-log row 6. Record: the release flag mechanism, the PR-vs-release gate contents (what each tier runs), and that the byte-equivalence baseline moved here and exactly why (pending keys now English-fill deterministically).

STEP 7 - FINAL RESPONSE FORMAT
Report:
- Status (done / blocked).
- Files touched (absolute paths).
- Validation, including the gate proofs: for each of the five gate cases, state the case and the observed result.
- Review verdicts (privacy-security-review, cross-platform-sync), each BLOCKING / non-blocking.
- Deferrals (anything punted to Phase 7+).
- One-line handoff to Phase 6 QA.

STOPPING RULES - stop and surface to the user if:
- A `pending` key could reach a release build (English could ship to a translated player).
- The PR gate can pass a key that is neither translated nor registered.
- The release flag cannot be reliably detected at build time.
```
