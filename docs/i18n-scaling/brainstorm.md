# brainstorm.md - i18n Scaling

## The problem (from the user, confirmed by exploration)
Adding one English-facing feature forces the contributor to produce real translations for all 14 locales in the same change, or `tsc` and the localization suite go red. One feature consumed ~200k tokens of localization work. Contributors with limited AI token budgets are effectively blocked from shipping English features. The locale data is also a set of large monoliths (`i18n.ts` ~940 KB, `world_entity_i18n.ts` ~260 KB, `talent_i18n.ts` ~187 KB, admin DICT ~108 KB), so any single-key edit pulls the whole table into context.

## Root cause (confirmed)
Full 14-locale completeness is enforced **per PR** when it belongs **at release**. Two mechanisms enforce it:
1. **The type:** every locale is `: typeof en`, so a missing key in any of 13 languages is a compile error.
2. **The tests:** key parity (H3), placeholder parity (M1c), copied-English checks, rendered quest/talent content - all run on every push.

## The vision (approved)
Move the boundary, not the standard. English at contribution time; the rest at release time, filled from a cheap per-locale delta. Keep every safety guarantee - just stop forcing humans to hand-produce 14-locale density per PR. Concretely, the four locked decisions in `state.md`:
1. **Two-tier CI gate** - cheap PR gate vs full release gate.
2. **Dense generated artifact** - preserves `tsc` completeness enforcement for English.
3. **Flat dotted-key overlays** for the 13 non-English locales (`en` stays nested).
4. **`t()` throws on untracked keys in dev/test; renders English for `pending` keys on non-release builds only.**

## Current state summary (what exists)
- **One assembled nested table** in `src/ui/i18n.ts`: `en` + 13 `: typeof en` locales spread from content layers (`shellStrings`, `hudStrings`, `abilityStrings`, `questStrings`, `itemStrings`, `classAbilityNames`, `itemNames`, `worldNames`, `merge*`). `supportedLanguages = Object.keys(translations)` = `[en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW, ko_KR, ja_JP, pt_BR, ru_RU]` (14).
- **`t()` returns the raw dotted key on a miss** (not English). Regex `{name}` interpolation, no pluralization. `formatNumber`/`formatMoney`/`formatDateTime` via `Intl`. ~3,532 `t()` call sites (hud ~1,183, render ~627, game ~254, admin ~203, net ~72).
- **Sim/server emit English; client matchers re-localize.** `sim_i18n.ts` (EXACT + ~28 RULES), `server_i18n.ts` (EXACT + ~37 RULES), plus hud-local EXACT maps + regex chains in `localizeErrorText`/`localizeSystemText`/`localizeLootText` that run first. `localize*Text` returns `null` on no match -> hud renders raw English.
- **S3 drift guard** scrapes `sim.ts`/`hud.ts` source at test time, enumerates every player emit, fails if unrecognized by the matchers. Runs `de_DE`-only. `COPIED_ALLOW` (~43) and `ALLOW_V07_SLASH` (~105) are hand-maintained literal Sets.
- **CI is one job** on PR + push; no PR/release split.
- **Admin SPA** ships a separate ~108 KB flat DICT (181 keys × 14), disconnected from the game table; already dense + flat.
- **Bundle:** all 14 locales eagerly bundled; no per-locale code-split. Selecting French still downloads all 14.

### Two grounded signals the RFC found
- Dialect overlay is half-present: `world_entity_i18n.ts` already aliases `es_ES = es` and `fr_CA = fr_FR` at module load, but `i18n.ts` hand-authors them as full `: typeof en` objects (the ~95% shared with the base is written twice). Phase 4 makes the overlay uniform.
- The `{} as WorldEntityTranslations` cast escapes the `: typeof en` guarantee. Safe today only because of the later reassignment; it is the exact compiler-bypass that ships gaps silently. The dense artifact + registry removes the need for such casts (Phase 4).

## Reusable infrastructure (leverage, do not reinvent)
- **`scripts/build_media_manifest.mjs`** - the zero-dep generated-artifact + do-not-edit-banner + reproducibility-check pattern. Every new `.mjs` here is a sibling of it.
- **Phase 0's byte-equivalence method** - deterministic serialize -> SHA-256 of the resolved 14-locale table, proven (1,583,881 bytes). This is the safety net for Phases 1-5.
- **The existing localization test suite** - `localization_fixes.test.ts` / `localization_coverage.test.ts` / `server_i18n.test.ts` stay the standard; the two-tier split re-homes which run at PR vs release, it does not delete coverage.
- **`scripts/localization_e2e.mjs`** - 14-locale visual/a11y E2E for final verification.

## New work needed (by surface)
- **Build (`scripts/`):** `i18n_build.mjs` (resolve + emit dense artifact), `i18n_resolved_hash.mjs` (byte-equivalence), `i18n_scan.mjs` (registry + content hash), `i18n_fill_worklist.mjs` (release delta).
- **Client data (`src/ui/`):** extract nested `en` (`i18n.en.ts`), flat sparse overlays (`i18n.locales/<lang>.ts`), dense generated artifact (`i18n.resolved.generated.ts`), registry (`i18n.status.json`), baseline hash file. Thin the `i18n.ts` runtime. Repoint `tOptional`/`hasTranslation`/`translationValue` at the dense table. Change `t()` miss behavior.
- **CI (`.github/workflows/ci.yml`):** split by ref into PR gate + release gate.
- **Tests (`tests/`):** byte-equivalence/reproducibility test; split S3 into `s3_registered`/`s3_localized`; relocate copied-English content checks to the release tier; turn `COPIED_ALLOW`/`ALLOW_V07_SLASH` into registry views.
- **Admin (`src/admin/`):** bring the DICT under the overlay+registry model; fix the hardcoded `alert`.
- **Optional:** `en_XA` pseudo-locale generator + selector wiring.

## Research findings
No third-party API or external surface is involved - this is a self-contained build/data/CI refactor with zero new dependencies. The only "external" reference is the existing generated-manifest discipline already in the repo. No web research required; nothing is OPEN on the technical side.

## OPEN items (need a human decision, not a code blocker)
- **Release fill ownership + API key (RFC §9.6):** who runs the release-time fill and owns the key; confirm bus factor. Resolve before the first real release fill (Phase 7 documents the workflow regardless).
- **Blocked-surface list (RFC §9.5):** the human confirms exactly which surfaces are `blocked: human-required` (quest narratives, class/ability names, CJK talent names are the locked default). Finalized in Phase 7.

## Open design questions already resolved (see state.md)
All four section-9 architectural decisions are locked (2026-06-16). The only deviation from the RFC's recommendation is decision 3: the user chose **flat** dotted-key overlays now, rather than nested-first-flat-later. The plan builds flat from Phase 3; `en` remains nested so `TranslationKey` typing and the ~3,532 call sites are untouched.
