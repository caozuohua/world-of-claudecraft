# qa-checklist.md - i18n Scaling whole-feature QA

Verified once at packet completion (Phase 9 QA, or Phase 6/8 QA if the packet stops early). This is the integration matrix; per-phase QA prompts handle phase-local verification.

## The invariant that must never break
> A key that is neither translated nor in the registry fails the PR gate; a key that is merely `pending` cannot survive to a cut release. No English is ever silently shipped to a translated player.

Verify this holds at both tiers with a live test: introduce a deliberately untranslated key, confirm it (a) passes the PR gate as `pending` and (b) blocks the release gate. Then remove it.

## Completeness & safety
- [ ] English `en` is complete and authoritative; `tsc` red-fails any missing/renamed/mistyped key against the dense resolved artifact.
- [ ] `i18n.resolved.generated.ts` and `i18n.status.json` are reproducible: regenerate then `git diff --exit-code` is clean. Neither has been hand-edited (do-not-edit banner present).
- [ ] The resolved 14-locale table is byte-identical to baseline through Phase 5; the baseline hash changed only in/after Phase 6 and that change was intended and reviewed.
- [ ] `t()` on a miss: throws for untracked keys in dev/test; renders English only for registry-`pending` keys and only on non-release builds. No `?? 'English'`-style fallback leaked into release builds.
- [ ] Placeholder parity holds for every translation that exists (M1c); the `srcHash` includes the sorted placeholder set so a placeholder change auto-demotes to `pending`.

## Two-tier gate
- [ ] PR gate runs only the cheap checks (tsc on dense artifact, registry-in-sync, `s3_registered`, placeholder parity for existing translations) and passes an English-only PR.
- [ ] Release gate runs the full suite (14-locale H3/H3b parity, copied-English rendered content from `localization_coverage.test.ts`, `s3_localized` across all 14 locales, empty-`pending`) and blocks if any locale is incomplete.
- [ ] `.github/workflows/ci.yml` selects the tier by ref correctly (PR/push to non-release vs `release/**`).

## Sim/server boundary (parity)
- [ ] `src/sim/` and `server/` still emit English only; no `t()`/DOM crept in.
- [ ] Every player-facing sim/server emit is recognized by the matchers (`s3_registered` at PR; `s3_localized` across 14 locales at release). The hud-local maps in `localizeErrorText`/`localizeSystemText`/`localizeLootText` are still counted in the coverage surface.
- [ ] `localizeSimText`/`localizeServerText`/`tSim`/`tServer`/`tEntity`/`tTalent` behave identically to pre-refactor for the same inputs (spot-checked across locales).

## Determinism
- [ ] No `Math.random`/`Date.now`/`performance.now` introduced in `src/sim/`. (Build-time hashing in `.mjs` scripts is fine; it is not sim code.)

## Persistence
- [ ] No Postgres `SCHEMA`/DDL change in this packet. (Confirm `server/db.ts`/`server/social_db.ts` untouched.) Admin Phase 8 changes only client DICT data, not persisted state.

## Performance / bundle
- [ ] The dense resolved artifact replaces (does not add to) the eager 14-locale table; main-bundle locale payload gzipped size is not larger than baseline. Record before/after.
- [ ] `npm run asset:budget` and `npm run perf:tour` within budget (unchanged - no asset/render change expected).
- [ ] Build time not materially regressed by the new `.mjs` steps.

## Copy & a11y
- [ ] No em dashes or emojis in player-facing copy (or in shipped strings these docs introduce).
- [ ] Numbers/money/dates still go through `formatNumber`/`formatMoney`/`formatDateTime`/`Intl`; note the `hud.ts:1674` cooldown bypass if not yet fixed.
- [ ] `scripts/localization_e2e.mjs` passes across the locale set (no clipped/overflowing/placeholder-marker text; aria/title/placeholder localized).
- [ ] Non-client surfaces audited (RFC §9.7): `index.html` hreflang + `data-i18n-content` meta, `document.title`, `admin.html`, admin DICT - none can surface a `pending`-English string to a real user. The hardcoded admin `alert` is fixed.
- [ ] Pseudo-locale `en_XA` (if Phase 9 done) is excluded from `supportedLanguages`, hreflang, and the release gate.

## Build gate
- [ ] CI-equivalent gate green locally: `npm test && npx tsc --noEmit && npm run build:env && npm run build:server && npm run build`.

## Contributor experience (the actual goal)
- [ ] A contributor can add a key to `en` (+ a matcher RULE if it originates in sim/server), run `npm run i18n:scan`, open a PR, and it is green - having authored zero non-English strings and opened no locale file.
- [ ] The release fill worklist (`npm run i18n:worklist`) produces a per-language delta of only new/stale keys; re-running on an unchanged repo is a zero-token no-op (content-hash cached).

## Deploy verification (only if deployed)
- [ ] After deploy, `curl -s localhost:8787/api/status` returns `{"ok":true,...}`; spot-check 2-3 locales render in the live client.
