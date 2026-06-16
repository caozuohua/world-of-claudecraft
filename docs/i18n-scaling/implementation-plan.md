# i18n Scaling - Implementation Plan

This is the TOC + canonical per-phase workflow + summary table. Each phase has a self-contained starter prompt in its own `phase-XX-{slug}.md` file; paste that into a fresh Opus 4.8 session to execute. Every implementation phase is followed by a dedicated QA phase (`phase-XX-qa.md`).

**Implements:** `docs/design/i18n-translation-scaling.md` (the RFC), with the four locked decisions in `state.md` applied (two-tier gate, dense generated artifact, **flat dotted-key overlays**, throw-on-miss-in-dev).

## The goal in one line
An English-only PR compiles and passes CI with zero non-English tokens authored by the contributor; the full 14-locale fill happens once, at release, from a cheap per-locale delta worklist; no English is ever silently shipped to a translated player.

## Phase index
| # | Phase | Slug | What it delivers | Risk |
|---|---|---|---|---|
| 1 | Foundation & monolith split | `foundation-split` | Extract nested `en` + type machinery + thin runtime; split locale files along seams; byte-equivalence baseline. Nested, behavior-preserving. | Med |
| 1 QA | Verify Foundation | `01-qa` | - | - |
| 2 | Dense resolved artifact | `resolved-artifact` | `scripts/i18n_build.mjs` -> `i18n.resolved.generated.ts` (nested, `: typeof en`); client+admin import it; reproducibility test; repoint `tOptional`/`hasTranslation`/`translationValue`. | Med |
| 2 QA | Verify Resolved artifact | `02-qa` | - | - |
| 3 | Flatten non-English locales | `flatten-overlays` | Convert the 13 non-English locales (main table + islands) to flat dotted-key overlays, still dense. `en` stays nested. | High |
| 3 QA | Verify Flatten | `03-qa` | - | - |
| 4 | Dialect inheritance dedup | `dialect-inheritance` | `es_ES extends es`, `fr_CA extends fr_FR`, `en_CA` alias of `en`; resolver applies base then overlay; remove `{} as` casts. | Med |
| 4 QA | Verify Dialects | `04-qa` | - | - |
| 5 | Status registry + scanner | `status-registry` | `scripts/i18n_scan.mjs` (no LLM/network) -> `i18n.status.json` with `srcHash`; allow-lists become registry views; registry-in-sync test. | High |
| 5 QA | Verify Registry | `05-qa` | - | - |
| 6 | The unlock: relax types + two-tier CI | `unlock-two-tier` | Sparse overlays legal; `t()` throw/English-pending behavior; CI split by ref; S3 -> `s3_registered`/`s3_localized`; content tests to release tier. **English-only PRs become legal here.** | High |
| 6 QA | Verify Unlock | `06-qa` | - | - |
| 7 | Release fill worklist + docs | `release-fill-tooling` | `scripts/i18n_fill_worklist.mjs` per-language delta + locked-terms glossary; contributor + maintainer workflow docs. | Low |
| 7 QA | Verify Fill tooling | `07-qa` | - | - |
| 8 | Admin catalog into the model | `admin-catalog` | Bring `src/admin/i18n.ts` under the overlay + registry + release-gate model; fix the hardcoded `alert`. | Med |
| 8 QA | Verify Admin | `08-qa` | - | - |
| 9 (optional) | `en_XA` pseudo-locale | `pseudo-locale` | Generated accent/bracket pseudo-locale via `?lang=en_XA`, excluded from `supportedLanguages`+hreflang; catches non-`t()` literals. | Low |
| 9 QA | Verify Pseudo-locale + packet teardown | `09-qa` | - | - |

**Minimum viable scope:** Phases 1-6 deliver the core goal (English-only PRs legal, no silent English). Phases 7-8 make the release workflow ergonomic and bring admin in. Phase 9 is optional hardening. The user may stop after any QA gate.

## Canonical per-phase workflow (every phase runs this)
Every phase runs on **Opus 4.8 at max effort** (1m-context variant where the file load demands it). `ultracode` is called out per phase when it is batch-heavy (locale sweeps, registry generation) and should orchestrate via a Workflow.

1. **Step 0 - Pre-flight.** Verify `git status` is clean and no concurrent session is mid-change in your files. Scan Claude Code memory (`MEMORY.md` index + entries matching the phase domain - esp. `shared-worktree-commit-care`, `no-em-dashes-or-emojis`).
2. **Step 1 - Load context.** Spawn one Explore agent to read `state.md`, `progress.md`, this phase's `phase-XX-*.md`, and the phase's source files. The main loop does NOT read `i18n.ts` (~13k), `world_entity_i18n.ts`, `talent_i18n.ts`, or `hud.ts` whole. The agent returns a focused summary.
3. **Step 2 - Choose orchestration + execute.** Pick the lightest tool. Default: parallel Agent fan-out, one agent per vertical slice; give each ONLY the Explore summary. For locale-sweep / registry-generation phases (3, 5, 6), the prompt tells the runner to add `ultracode` and drive a Workflow (pipeline + adversarial-verify). Use `isolation: "worktree"` only if agents edit overlapping files in parallel.
4. **Step 3 - Validation + multi-agent review.** Run the validation matrix from `state.md` for this change type (always includes the byte-equivalence gate for Phases 1-5). Spawn review agents in parallel, prompted for COVERAGE not filtering:
   - `privacy-security-review` (always)
   - `migration-safety` (only Phase 8 touches persisted DB state; otherwise skip - this packet is UI/build/CI, no `SCHEMA` change)
   - `cross-platform-sync` (any phase touching the sim/server i18n matchers, `s3` guard, or the localize seam - Phases 1, 5, 6, 7)
   - `qa-checklist` (at phase completion)
   - Resume any truncating agent with: *"Stop reading more files. Output the full report now based on what you've already seen. No more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."*
   - Do not commit until each reports no BLOCKING issues.
5. **Step 4 - Update docs + memory.** Update `progress.md` (status, deferrals) and `state.md` (new files/scripts/tests, locked decisions, the per-phase additions log). Record surprising rules in Claude Code memory. Commit doc updates with the implementation (EXPLICIT paths).

## Agent scaling guidance
- This packet is mostly **vertical build/data slices**, not feature surface across three hosts. The default fan-out per phase is small (1-3 agents).
- **Escalate to a Workflow** for the locale sweeps: Phase 3 (convert 13 locales × multiple island files to flat - uniform, batchy), Phase 5 (hash every `en`/matcher/admin key across locales and build the registry), and Phase 6 (verify the two-tier gate behaves on dozens of sample keys). These exceed the ~5-agent manual cap and want structured-output + adversarial-verify.
- **Merge trivial work into one agent** (e.g., adding one package.json script + one `.mjs` does not need a dedicated agent).
- **Each agent owns a complete vertical slice** (the data + its tests + its generator), never split by file type.

## Code hygiene (every phase)
- New scripts/generators/tests get tests. The build scripts get a unit/reproducibility test; the runtime changes get vitest coverage.
- Delete dead code as you replace it: when `i18n.ts` becomes the thin runtime, the old inline locale blocks move out, they do not get left behind commented. Zero unused imports. Uphold the `src/sim/` import invariant (this packet does not touch sim imports, but do not introduce a violation).
- Never hand-edit generated files (`i18n.resolved.generated.ts`, `i18n.status.json`, the media manifest); regenerate via the build.

## What this packet does NOT do (global out-of-scope)
- No change to the deterministic sim or the client-boundary localization model; sim/server stay language-agnostic.
- No auto-translation of bespoke prose (quest narratives, class/ability names, CJK talent names) - `blocked: human-required`.
- No new runtime dependency, no i18n framework.
- No `SCHEMA`/DDL change, no persisted-state change (Phase 8 touches only the admin DICT data shape and bundle, not Postgres).
- No removal of the sim/server matcher RULE requirement: a new parameterized emit still needs its RULE in the same PR.

## How to start a phase
Open `phase-01-foundation-split.md`, copy the **Starter Prompt** block, paste it into a fresh Opus 4.8 Claude Code session. When it finishes, start `phase-01-qa.md` in another fresh session. Repeat through the index.
