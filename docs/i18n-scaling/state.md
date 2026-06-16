# state.md - i18n Scaling cross-phase cheat sheet

The single source of truth a fresh session reads before doing anything. Record decisions once here; reference forever. Update at the end of every phase.

---

## Current status
- **Active phase:** Phase 1 (not started)
- **Branch:** `refactor/i18n-phase-naming` (Phase 0 - the `phaseN`->content-name rename - is DONE and lives here). Later phases may branch `feature/i18n-<slug>` off this; confirm with the user before branching (shared worktree).
- **RFC:** `docs/design/i18n-translation-scaling.md` - the authoritative design. This packet implements it with the four decisions below applied.

## Locked design decisions (maintainer sign-off, 2026-06-16)
1. **Two-tier CI gate.** CI splits by git ref into a cheap PR gate and a full release gate. An English-only PR is legal once Phase 6 lands.
2. **Dense generated artifact keeps `tsc` safety.** A no-dep `.mjs` build script overlays sparse locales onto `en`, fills gaps from English, and emits `src/ui/i18n.resolved.generated.ts` typed `: typeof en`. Client and admin import the generated artifact. Reproducibility-checked (`git diff --exit-code`) like the media manifest.
3. **Flat dotted-key overlays for the 13 non-English locales.** `en` stays a **nested** object (authoritative base; drives `TranslationKey = Leaves<typeof en>` that ~3,532 call sites use). Each non-English locale is a flat `Partial<Record<TranslationKey, string>>` containing only translated keys. `en_CA` is a thin alias of `en`; `es_ES`/`fr_CA` are dialect overlays over `es`/`fr_FR`.
4. **`t()` on miss:** throw on an *untracked* key in dev/test; render English for a registry-`pending` key on **non-release builds only**; release builds require an empty `pending` set. This deliberately relaxes "the rendered text always comes from `t()`" for the dev/pre-release window only - a non-release build carrying `pending` keys must never be deployed.

### Operational decisions (RFC §9.5-9.7)
- **LLM fill scope (locked):** worklist generation is automated; **prose is blocked-by-default** - quest narratives, class/ability names, and CJK talent names are `blocked: human-required` and never auto-filled. A bot may fill mechanical UI chrome only. The human owns the blocked-surface list.
- **OPEN - release fill ownership / API key (RFC §9.6):** who runs the release-time fill pass and owns the key? Bus factor must be acceptable; the worklist must be plain enough for a second maintainer. Not a code blocker; resolve before the first real release fill.
- **Non-client consumer audit (RFC §9.7):** Phase 6 + Phase 8 QA must confirm nothing outside the client seam (server-rendered HTML, `document.title`, `index.html` hreflang tags, the admin DICT, any `data-i18n-content` meta) can surface a `pending`-English string to a real user, and that the `en_XA` pseudo-locale (Phase 9) is excluded from `supportedLanguages` and hreflang.

## Non-negotiable invariants (carry into every phase)
- **`src/sim/` and `server/` stay language-agnostic** - no `t()`, no DOM. They emit English; the client matchers (`src/ui/sim_i18n.ts`, `src/ui/server_i18n.ts`, plus the `hud.ts`-local maps) re-localize at the boundary. Translation resolves only at the client boundary.
- **Determinism is untouched.** This is a UI/build/CI refactor; do not introduce `Math.random`/`Date.now`/`performance.now` anywhere in `src/sim/`. (The scanner/build scripts run at build time, not in the sim, so hashing there is fine.)
- **No new runtime dependency, no i18n framework.** Plain TypeScript data + `.mjs` build scripts, consistent with `scripts/build_media_manifest.mjs`.
- **Generated files are never hand-edited.** `i18n.resolved.generated.ts` and `i18n.status.json` carry the do-not-edit banner and are reproducibility-checked.
- **No em dashes or emojis** in player-facing copy or in these docs' shipped strings.
- **Shared worktree:** stage explicit paths, never `git add -A`. A concurrent session may share this checkout.

## The byte-equivalence safety net (Phases 1-5)
Every behavior-preserving phase is gated by **byte-equivalence of the resolved 14-locale table**. Phase 0 proved the method: the resolved table is deterministic (1,583,881 bytes on `main`, matching SHA-256). The mechanism for this packet:
- A script `scripts/i18n_resolved_hash.mjs` serializes the assembled/resolved `translations` table deterministically (stable key order) and prints its SHA-256.
- A committed baseline `src/ui/i18n.resolved.sha256` holds the expected hash.
- A test `tests/i18n_resolved_equivalence.test.ts` recomputes and asserts equality.
- **The baseline hash changes ONLY in phases that deliberately change resolved output (Phase 6 onward, when `pending` keys begin to English-fill).** Phases 1-5 must leave it byte-identical. If a phase needs to touch the baseline, that is a red flag - stop and confirm the change is intended.

## Validation matrix by change type
- **Behavior-preserving structural phase (1-5):** `npx tsc --noEmit` + `npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts tests/server_i18n.test.ts tests/i18n_resolved_equivalence.test.ts` + the resolved-table byte-equivalence gate (hash unchanged).
- **Generated-artifact phase (2, 5):** also the reproducibility check - regenerate, then `git diff --exit-code` on `i18n.resolved.generated.ts` / `i18n.status.json` must be clean.
- **CI / gate phase (6):** the two-tier split itself must be tested: a deliberately English-only sample key passes the PR tier; a deliberately incomplete locale fails the release tier; the full localization suite passes at the release tier.
- **Admin phase (8):** admin builds and renders all 14 locales; `npm run build` (admin entry) clean; admin registry-in-sync.
- **Full-stack / pre-merge (every phase before declaring done):** `npm test && npx tsc --noEmit && npm run build:env && npm run build:server && npm run build` (mirrors `.github/workflows/ci.yml`).
- **Bundle-size check (where relevant):** note the gzipped size of the main bundle's locale payload before/after; the dense artifact must not balloon it (it replaces, not adds to, today's eager 14-locale table).

## Key file paths
### Existing (today)
- `src/ui/i18n.ts` (~13.2k lines) - types, `en`, 13 full `: typeof en` locales, assembler (`shellStrings`/`hudStrings`/`abilityStrings`/`questStrings`/`itemStrings`/`classAbilityNames`/`itemNames`/`worldNames`/`merge*`), `t()`, `tOptional`, `hasTranslation`, `translationValue`, `formatNumber`/`formatMoney`/`formatDateTime`/`moneyParts`, `getLanguage`/`setLanguage`/`isSupportedLanguage`, `supportedLanguages`, `TranslationKey`/`Leaves`.
- `src/ui/world_entity_i18n.ts` (~260 KB) - class/ability/item/mob/NPC/quest/zone/dungeon/POI names + narratives. NOTE: `es_ES`/`fr_CA` are already aliased to `es`/`fr_FR` at module load via `{} as WorldEntityTranslations` casts.
- `src/ui/talent_i18n.ts` (~187 KB) - talent name overrides + description rules.
- `src/ui/entity_i18n.ts` (~297 lines) - runtime entity resolver (`tEntity`); not a key source.
- `src/ui/sim_i18n.ts` (~1,516 lines) - `enTable` + `BASE_DICT` + `PET_DICT` -> `DICT`; EXACT map (auto-built) + ~28 regex RULES; `localizeSimText()`/`tSim()`.
- `src/ui/server_i18n.ts` (~129 lines) - inlined `DICT` + EXACT + ~37 regex RULES; `localizeServerText()`/`tServer()`.
- `src/ui/hud.ts` - `localizeErrorText` (~L2677), `localizeSystemText` (~L2783), `localizeLootText` (~L2867): hud-local EXACT maps + regex chains that run BEFORE delegating to `localizeSimText`/`localizeServerText`. The matcher-coverage surface includes these.
- `src/admin/i18n.ts` (~78 lines, ~108 KB DICT) - flat `Record<locale, Record<key,string>>`, 181 keys × 14 locales, already dense+flat; `classLabel()`. Separate `admin.html` bundle.
- `index.html` - 185 `data-i18n*` attributes, 14 hreflang links, OG/Twitter/JSON-LD meta, `data-i18n-content`.
- `admin.html` - static `<title>`, meta; admin reads locale from `?lang=`/localStorage at runtime.
- `tests/localization_fixes.test.ts` (~669 lines) - B1, L3/L4, H1/H1b/H2, M1/M1b/M1c, H3/H3b, H4b, S1/S2, R1, A1, **S3** (the drift guard that scrapes `sim.ts`/`hud.ts` source, `de_DE`-only today). `COPIED_ALLOW` (~43) and `ALLOW_V07_SLASH` (~105) literal Sets live here.
- `tests/localization_coverage.test.ts` - 14-locale key parity, rendered quest/talent content, accents, CJK-no-Latin, hreflang.
- `tests/server_i18n.test.ts` - server DICT parity + copied-English.
- `.github/workflows/ci.yml` - single `build` job on PR + push to `main`/`dev-*`/`release/**`. `npm test` runs the full localization suite on every push.
- `scripts/build_media_manifest.mjs` - the zero-dep generated-artifact pattern to copy.
- `scripts/localization_e2e.mjs` - 14-locale E2E (homepage/mobile/in-game/a11y).

### New (created by this packet - see per-phase files for exactly when)
- `src/ui/i18n.en.ts` - authoritative nested `en` + `Leaves`/`TranslationKey`/`DeepPartial` machinery. (Phase 1)
- `src/ui/i18n.locales/<lang>.ts` - flat `Partial<Record<TranslationKey,string>>` sparse overlays; the only files a translator edits. (Phase 3)
- `src/ui/i18n.resolved.generated.ts` - generated dense `: typeof en` table; client + admin import this. (Phase 2)
- `src/ui/i18n.status.json` - generated registry: `translated`/`pending`/`blocked` + `srcHash` + `by`. (Phase 5)
- `src/ui/i18n.resolved.sha256` - committed byte-equivalence baseline. (Phase 1)
- `scripts/i18n_build.mjs` - overlays + emits the resolved artifact. (Phase 2)
- `scripts/i18n_resolved_hash.mjs` - deterministic SHA-256 of the resolved table. (Phase 1)
- `scripts/i18n_scan.mjs` - no-LLM/no-network scanner that rebuilds the registry. (Phase 5)
- `scripts/i18n_fill_worklist.mjs` - emits the per-language `pending` delta for the release fill. (Phase 7)
- `tests/i18n_resolved_equivalence.test.ts` - byte-equivalence + reproducibility test. (Phase 1/2)

## New package.json scripts (added across phases)
- `i18n:build` -> `node scripts/i18n_build.mjs` (Phase 2; folded into `npm run build` + `pretest`)
- `i18n:hash` -> `node scripts/i18n_resolved_hash.mjs` (Phase 1)
- `i18n:scan` -> `node scripts/i18n_scan.mjs` (Phase 5; folded into `pretest`)
- `i18n:worklist` -> `node scripts/i18n_fill_worklist.mjs` (Phase 7)

## Per-phase additions log (fill in as phases complete)
| Phase | New files | New scripts | New tests | Notes |
|---|---|---|---|---|
| 1 | - | - | - | (pending) |
| 2 | - | - | - | (pending) |
| 3 | - | - | - | (pending) |
| 4 | - | - | - | (pending) |
| 5 | - | - | - | (pending) |
| 6 | - | - | - | (pending) |
| 7 | - | - | - | (pending) |
| 8 | - | - | - | (pending) |
| 9 | - | - | - | (pending, optional) |

## Glossary of locked terms (for the release fill; never auto-translate)
Project name "World of ClaudeCraft"; the 9 class names; ability names; zone/dungeon proper nouns. The release fill ships this glossary with every batch so per-locale terminology does not drift. (Authored in Phase 7.)

## Known gotchas / OPEN items
- `tOptional`, `hasTranslation`, and internal `translationValue` read the table directly - under sparse overlays a key can be genuinely absent at runtime. They MUST be pointed at the dense resolved artifact, not the raw overlays, or their semantics change (Phase 2 correctness item).
- The S3 guard is source-text scraping (regex over `sim.ts`/`hud.ts`); splitting it into `s3_registered`/`s3_localized` (Phase 6) preserves the scraping approach and its brittleness. Treat matcher coverage (including hud-local maps) as ongoing maintenance, not solved.
- `world_entity_i18n.ts` already aliases `es_ES`/`fr_CA`; the main `i18n.ts` does not. Phase 4 (dialect dedup) and Phase 5 must account for the two tables being at different starting points.
- The `{} as WorldEntityTranslations` cast escapes the `: typeof en` guarantee. Phase 4 replaces it with real overlay semantics.
- Admin DICT is already flat + dense; it is the closest to the target shape. Phase 8 brings it under the registry + sparse model without regressing its 14-locale completeness.
- One hardcoded `window.alert(...)` at ~`src/admin/main.ts:401` is missing a translation (flagged during exploration). Fix it in Phase 8.
- A cooldown timer at ~`src/ui/hud.ts:1674` uses `Math.ceil(cd).toString()` instead of `formatNumber` (number-localization bypass). Note for Phase 6/8 polish; not load-bearing.
