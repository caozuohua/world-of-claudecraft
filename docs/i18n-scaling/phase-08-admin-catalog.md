# Phase 8 - Bring the admin catalog under the model

Bring `src/admin/i18n.ts` under the same overlay + registry + release-gate model the
game client got in Phases 1-7, so admin keys benefit from the unlock (English-only admin
PRs become legal) without regressing the admin SPA's 14-locale completeness. Because the
admin DICT is already flat and dense, the work is mostly mechanical: split its English
base from sparse non-English overlays, route its keys through the registry and worklist,
keep the admin SPA importing a dense resolved admin table so tsc and runtime completeness
still hold, and close the remaining hardcoded-string gaps (the `window.alert(...)` at about
`src/admin/main.ts:401` and any others). This phase also runs the non-client-consumer audit
(RFC 9.7).

## Whole-packet context

- Goal of the whole packet: an English-only PR passes CI; a full 14-locale fill happens at
  release; no silent English ever ships. Operators are users, so the admin dashboard is in
  scope for localization.
- Locked decisions: (1) two-tier CI gate (PR tier allows pending-English, release tier
  requires empty-pending); (2) a dense generated artifact keeps `tsc` completeness safety;
  (3) flat dotted-key overlays for non-English, `en` authored nested; (4) `t()` semantics:
  throw on untracked key in dev, serve English for a pending (non-release) key, empty-pending
  required at release.
- Invariants for the packet: `src/sim/` and `server/` stay language-agnostic; determinism is
  untouched; no new dependency or framework; generated files are never hand-edited; the
  worktree is shared with other sessions so every commit stages EXPLICIT paths only. THIS
  PACKET MAKES NO Postgres SCHEMA / DDL OR PERSISTED-STATE CHANGE. The admin change is a
  client DICT plus bundle change only.
- Cheat sheet lives at `docs/i18n-scaling/state.md`; running status at `docs/i18n-scaling/progress.md`.

## Where the codebase is after Phases 1-7

The game client now uses:
- nested English base at `src/ui/i18n.en.ts`,
- sparse flat per-locale overlays at `src/ui/i18n.locales/<lang>.ts`,
- a dense generated artifact at `src/ui/i18n.resolved.generated.ts`,
- a registry at `src/ui/i18n.status.json` plus a scanner at `scripts/i18n_scan.mjs`,
- two-tier CI with an empty-pending release gate,
- and a release fill worklist generator at `scripts/i18n_fill_worklist.mjs`.

## What the admin surface looks like today

- The admin dashboard is a SEPARATE SPA: it has its own `admin.html` entry and lives in
  `src/admin/`. It is bundled separately and does NOT share code with the game i18n.
- `src/admin/i18n.ts` is a standalone flat `DICT` of shape
  `Record<locale, Record<key, string>>`, 181 keys across 14 locales, ALREADY dense and flat.
  It is the closest existing surface to the packet's target shape. It exposes a `classLabel()`
  helper.
- The registry-in-sync test from Phase 5 ALREADY requires every admin key to appear in the
  registry, so the registry expects admin keys; this phase makes the scanner actually emit
  them with hashes.
- Exploration flagged a hardcoded `window.alert(...)` at about `src/admin/main.ts:401` that is
  missing a translation. There may be others; the implementer must grep for them.

The 14 locales are: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR,
ja_JP, pt_BR, ru_RU.

---

## Implementation starter prompt

Paste the block below into a fresh Claude Code session to execute Phase 8.

```
This is Phase 8 of the i18n Scaling feature: Bring the admin catalog under the model.

MODEL: Use Opus 4.8 (claude-opus-4-8) if available; otherwise the strongest model on hand.
HARNESS: Claude Code, shared git worktree. Commit EXPLICIT paths only, never `git add -A`.
ULTRACODE is OPTIONAL here: the admin DICT is small (181 keys), so do not force it, but
parallel Agent fan-out for independent investigation and per-locale batch work is encouraged.

GOAL (one sentence): Move src/admin/i18n.ts onto the overlay + registry + release-gate model
so an English-only admin PR is legal at the PR tier while full 14-locale admin completeness is
gated at release, the admin stays a separate bundle that renders all 14 locales, and the
remaining hardcoded admin strings are localized.

STEP 0 PRE-FLIGHT
- Confirm the working tree is clean (`git status`); if dirty, stop and surface what is there
  before touching anything (shared worktree).
- Scan memory for prior context on this packet and the admin surface; note anything relevant.

STEP 1 LOAD CONTEXT (one Explore agent)
Launch an Explore agent to read and summarize, returning a tight brief (no file dumps):
- docs/i18n-scaling/state.md, docs/i18n-scaling/progress.md, and this phase file
  (docs/i18n-scaling/phase-08-admin-catalog.md).
- The admin DICT shape in src/admin/i18n.ts: how DICT is structured, the exact key set, and
  what classLabel() does and where it is called.
- How src/admin/main.ts selects the active locale and renders strings (where it reads DICT,
  how locale is chosen, any per-key lookups).
- The game-side pattern to MIRROR (do not import it, just match the shape): src/ui/i18n.en.ts
  (nested en), src/ui/i18n.locales/<lang>.ts (sparse flat overlays),
  src/ui/i18n.resolved.generated.ts (dense generated artifact), src/ui/i18n.status.json
  (registry), scripts/i18n_scan.mjs (scanner), scripts/i18n_fill_worklist.mjs (worklist).
- A grep of src/admin/ AND admin.html for hardcoded operator-visible strings: alert/confirm/
  prompt, setAttribute('title'|'aria-label'|'aria-*'|'placeholder'|'alt'), document.title,
  innerHTML/static HTML text, and any string literal that reaches the DOM as visible text.
The agent returns: (a) the admin English base (the en slice of DICT), (b) the non-English admin
slices per locale, (c) the import/render path admin uses to look up strings, and (d) the list of
hardcoded admin strings to fix (file + approx line + current literal).

STEP 2 CHOOSE ORCHESTRATION + EXECUTE
Two slices. Run Slice A first (the structural move), then Slice B (gaps + audit). Within each
slice, fan out parallel agents for per-locale or per-file batch work where independent.

Slice A - admin overlay model:
- Split the admin DICT into an English admin base plus sparse flat per-locale admin overlays.
  Match the game-side shape: an authored English base (the source of truth for admin keys) and
  one sparse flat dotted-key overlay file per non-English locale containing only keys that
  differ from / translate the English base.
- Add a build step (or extend the existing i18n build) so admin RESOLVES to a dense admin table
  that the admin SPA imports. The resolved admin table must be complete for all 14 locales at
  build time so tsc and runtime completeness are preserved exactly as today. Treat the resolved
  admin artifact as generated: reproducible from base + overlays, never hand-edited.
- Wire the scanner (scripts/i18n_scan.mjs) and registry (src/ui/i18n.status.json or the admin
  registry surface the registry-in-sync test reads) so admin keys are TRACKED with a srcHash, the
  same way game keys are. The Phase 5 registry-in-sync test already expects admin keys to appear;
  make the scanner actually emit them.
- Ensure scripts/i18n_fill_worklist.mjs includes admin pending keys per language so the release
  fill worklist covers admin.
- KEEP THE ADMIN BUNDLE SEPARATE. Do not pull the game locale table or game resolved artifact
  into the admin bundle, and do not pull admin into the game bundle. Admin imports its own
  resolved admin table only.

Slice B - close gaps + audit:
- Localize the hardcoded window.alert(...) at about src/admin/main.ts:401 by routing it through
  the admin key lookup (add the key to the admin English base + overlays + registry like any
  other admin key). Localize every other hardcoded admin string the Explore agent found
  (alert/confirm/prompt, title/aria/placeholder/alt attributes, document.title, static HTML).
- Run the NON-CLIENT-CONSUMER AUDIT (RFC 9.7): confirm that none of the following can surface a
  pending-English string to a real user at release: index.html hreflang links + any
  data-i18n-content meta tags, document.title for both entries, admin.html static markup, and
  the admin DICT / resolved admin table. Document the audit result (what was checked, what is
  safe, anything that needs a follow-up).

INVARIANTS (must hold):
- Admin stays a SEPARATE bundle: no game locale table or game resolved artifact bundled into admin.
- Admin 14-locale completeness is gated at RELEASE; an English-only admin PR is LEGAL at the PR tier.
- Operators are users: ALL admin operator-visible strings are localized through the model.
- The generated admin artifact is reproducible from base + overlays and is NEVER hand-edited.
- No new dependency or framework. No Postgres / DDL / persisted-state change. Determinism untouched.
- Commit EXPLICIT paths only (shared worktree).

OUT OF SCOPE:
- No pseudo-locale (that is Phase 9).
- No change to the game-side gate behavior or game resolved artifact semantics.
- No server-side change.

STEP 3 VALIDATION + REVIEW
- `npx tsc --noEmit` clean.
- `npm run build` succeeds; confirm the admin entry builds and the resolved admin table is
  complete for all 14 locales. Spot-check 2-3 locales render in the admin SPA (e.g. de_DE,
  zh_CN, and one of the regional variants like fr_CA).
- Confirm registry-in-sync now includes admin keys and the worklist includes admin pending keys.
- `npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts`
  all green. The A1 admin classLabel coverage assertion MUST stay green.
- If practical, take a mobile/admin screenshot or run scripts/localization_e2e.mjs as a spot check.
- Launch PARALLEL review agents (COVERAGE mode, not filtering - surface everything, do not
  pre-judge): privacy-security-review (admin is the operator / moderation surface),
  cross-platform-sync, qa-checklist. Use truncation-resume if an agent's output is cut off.
- DO NOT COMMIT until there is no BLOCKING finding.

STEP 4 COMMIT CADENCE (three commits, explicit paths each)
1. refactor(admin): split admin DICT into English base and sparse overlays
2. feat(admin): track admin keys in the i18n registry and worklist
3. fix(admin): localize remaining hardcoded admin strings

STEP 5 ACCEPTANCE (all must be true)
- The admin DICT is under the overlay + registry + release-gate model.
- Admin is still a separate bundle and renders all 14 locales.
- Admin keys appear in the registry and in the worklist.
- An English-only admin PR is legal at the PR tier; 14-locale admin completeness is gated at release.
- The src/admin/main.ts:401 alert and every other hardcoded admin string is localized.
- The non-client-consumer (RFC 9.7) audit passes.
- tsc, the test suite, and the build are all green.

STEP 6 DOC UPDATES
- progress.md: add the Phase 8 checklist with each acceptance item ticked.
- state.md: add additions-log row 8; mark the hardcoded-admin-alert gotcha as FIXED; record the
  admin overlay paths and the resolved admin artifact path; note the RFC 9.7 audit result.

STEP 7 FINAL RESPONSE FORMAT
Report: STATUS (done / blocked), FILES changed (absolute paths), VALIDATION run + results,
review-agent VERDICTS (blocking vs non-blocking), DEFERRALS (anything pushed to a later phase),
and a HANDOFF note to Phase 8 QA (phase-08-qa.md).

STOPPING RULES (stop and surface, do not push through):
- Stop if admin 14-locale completeness would regress at the release tier.
- Stop if the game locale table or game resolved artifact would get pulled into the admin bundle.
- Stop and surface if any non-client surface can leak a pending-English string to a real user.
```
