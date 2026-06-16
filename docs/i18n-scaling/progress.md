# progress.md - i18n Scaling

## Status table
| Phase | Status | Started | Completed |
|---|---|---|---|
| 0 - Layer rename (pre-packet) | DONE | - | (on branch `refactor/i18n-phase-naming`) |
| 1 - Foundation & split | NOT STARTED | | |
| 1 QA | NOT STARTED | | |
| 2 - Resolved artifact | NOT STARTED | | |
| 2 QA | NOT STARTED | | |
| 3 - Flatten overlays | NOT STARTED | | |
| 3 QA | NOT STARTED | | |
| 4 - Dialect inheritance | NOT STARTED | | |
| 4 QA | NOT STARTED | | |
| 5 - Status registry | NOT STARTED | | |
| 5 QA | NOT STARTED | | |
| 6 - Unlock + two-tier CI | NOT STARTED | | |
| 6 QA | NOT STARTED | | |
| 7 - Release fill tooling | NOT STARTED | | |
| 7 QA | NOT STARTED | | |
| 8 - Admin catalog | NOT STARTED | | |
| 8 QA | NOT STARTED | | |
| 9 - Pseudo-locale (optional) | NOT STARTED | | |
| 9 QA + teardown | NOT STARTED | | |

## Deliverable checklists

### Phase 1 - Foundation & monolith split
- [ ] Authoritative nested `en` + `Leaves`/`TranslationKey`/`DeepPartial` machinery extracted to `src/ui/i18n.en.ts`
- [ ] `src/ui/i18n.ts` is the thin runtime; ALL public exports unchanged (`t`, `tOptional`, `hasTranslation`, formatters, `getLanguage`/`setLanguage`, `supportedLanguages`, types)
- [ ] Locale data split along seams into separate files (behavior-preserving; still nested `: typeof en`)
- [ ] `scripts/i18n_resolved_hash.mjs` + committed `src/ui/i18n.resolved.sha256` baseline
- [ ] `tests/i18n_resolved_equivalence.test.ts` asserts the resolved table matches the baseline
- [ ] tsc clean; full localization suite green; resolved table byte-identical to pre-change

### Phase 2 - Dense resolved artifact
- [ ] `scripts/i18n_build.mjs` overlays locales onto `en`, emits `src/ui/i18n.resolved.generated.ts` (nested, `: typeof en`, do-not-edit banner)
- [ ] Client + admin import the generated artifact; `tOptional`/`hasTranslation`/`translationValue` repointed at the dense table
- [ ] `i18n:build` wired into `npm run build` + `pretest`; reproducibility `git diff --exit-code` test green
- [ ] Resolved table byte-identical to Phase 1 output

### Phase 3 - Flatten non-English locales
- [ ] 13 non-English locales (main table + `world_entity_i18n`/`talent_i18n` non-English data) converted to flat dotted-key overlays in `src/ui/i18n.locales/<lang>.ts`
- [ ] `en` stays nested; generator resolves flat overlays + nested `en` to the same dense artifact
- [ ] Overlays still dense (every key present) at this stage; key-completeness test passes
- [ ] Resolved table byte-identical

### Phase 4 - Dialect inheritance dedup
- [ ] `es_ES` overlay carries only divergences from `es`; `fr_CA` only from `fr_FR`; `en_CA` thin alias of `en`
- [ ] Resolver applies base then dialect overlay
- [ ] `{} as WorldEntityTranslations` casts replaced with real overlay semantics
- [ ] Resolved table byte-identical (dedup must not change output)

### Phase 5 - Status registry + scanner
- [ ] `scripts/i18n_scan.mjs` (no LLM/network) walks `en` + matcher + admin keys, computes `srcHash` (English text + sorted placeholders), writes `src/ui/i18n.status.json`
- [ ] Registry states: `translated` (with `srcHash`, `by`), `pending`, `blocked` (with `reason`)
- [ ] `COPIED_ALLOW` / `ALLOW_V07_SLASH` become generated views over the registry
- [ ] `i18n:scan` in build + `pretest`; registry reproducibility + registry-in-sync tests green
- [ ] `pending` set empty at this stage (everything still dense)

### Phase 6 - The unlock: relax types + two-tier CI
- [ ] Flat overlays relaxed to `Partial<Record<TranslationKey,string>>` (sparse legal)
- [ ] `t()` throws on untracked key in dev/test; renders English for `pending` keys on non-release builds only; release build asserts empty `pending`
- [ ] `.github/workflows/ci.yml` split by ref: PR gate (tsc on dense artifact, registry-in-sync, `s3_registered`, placeholder parity for existing) vs release gate (14-locale H3/H3b, copied-English content, `s3_localized`, empty-pending)
- [ ] S3 guard split into `s3_registered` (PR) + `s3_localized` (release); content tests moved to release tier
- [ ] Proof: English-only sample key passes PR tier; deliberately incomplete locale fails release tier

### Phase 7 - Release fill worklist + docs
- [ ] `scripts/i18n_fill_worklist.mjs` emits per-language `pending` delta (`{key, english, placeholders, siblings}`), one batch per language
- [ ] Locked-terms glossary shipped with the worklist
- [ ] Contributor + maintainer workflow documented (in `src/ui/CLAUDE.md` and/or `docs/`)
- [ ] Worklist round-trip: fill an overlay -> scan -> `pending` shrinks

### Phase 8 - Admin catalog into the model
- [ ] `src/admin/i18n.ts` brought under the overlay + registry + release-gate model (English-only admin PRs legal; 14-locale completeness gated at release)
- [ ] Hardcoded `window.alert(...)` at ~`src/admin/main.ts:401` localized
- [ ] Admin renders all 14 locales; admin build clean; non-client-consumer audit (RFC §9.7) passes

### Phase 9 - `en_XA` pseudo-locale (optional)
- [ ] Generated accent/bracket pseudo-locale over every `en` leaf, selected via `?lang=en_XA`
- [ ] Excluded from `supportedLanguages`, hreflang, and the release gate
- [ ] Surfaces hard-coded literals that never became `t()` keys

## QA-phase checklists (fixes applied, tests added, dead code removed)
Filled in by each QA session.

## Notes (per phase, post-completion)
- Phase 0: pure rename, verified byte-identical resolved table (SHA-256), 73 localization tests green. Prerequisite readability step, already on the branch.
