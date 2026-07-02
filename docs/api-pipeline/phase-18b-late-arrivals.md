# Phase 18b: Migrate the late-arrival families (github, desktop-login, daily-rewards): net-new since the packet

Phase 18b migrates the twelve routes that arrived on this branch through release merges AFTER
their would-have-been migration waves shipped, so no Phase 10 to 18 doc owns them: the GitHub
identity family (4 routes, `server/github.ts`, arrived with the v0.18.0 merge), the
desktop-login handoff pair (2 routes, `server/desktop_login.ts`, arrived with the v0.19.0
merge ada776e9), and the daily-rewards feature (3 bearer-gated player routes plus 3
secret-gated `/internal/daily-rewards/*` ops routes, `server/daily_rewards.ts`, arrived with
the v0.19.0 merge df91eee8). Until this phase lands they are legacy-only delegate-served, and
the Phase 25 ladder deletion would drop all twelve. This phase MUST land before Phase 25 and
SHOULD land before Phase 19 (whose limiter inventory and POLICIES rework otherwise have no
owning phase for these routes' limiter decisions).

The 2026-07-02 drift audit already filed the corpus groundwork, so this phase inherits it done:
the 6 daily-rewards `SURFACE_INVENTORY` rows (+ the `secret-daily-reward` AUTH_SCOPE), the 3
`API_CONTENT_TYPE` entries, the freshness gate scanning `server/daily_rewards.ts`
(`DISPATCHER_SOURCES`), and `completeness.test.ts` deriving legacy-served paths from
main.ts + daily_rewards.ts with the ops family excluded from the Phase 18 internal-ladder pins.
The github + desktop-login rows were filed at their respective release merges.

It stays under 40% context because every route ports parity-first onto the established Phase
10-18 template (thin handlers reusing the existing cores byte-for-byte); the only genuinely new
primitive is a fail-closed variant of `requireInternalSecret`.

### Starter Prompt

````
This is Phase 18b of the API Pipeline re-architecture: Migrate the late-arrival families (github, desktop-login, daily-rewards).
Model: Opus 4.8, xhigh effort. Harness: Claude Code.
ULTRACODE: do NOT use ultracode here. Twelve thin parity-first ports against existing primitives; hand-spawn parallel agents instead.
Goal: Move the GitHub identity family, the desktop-login pair, the daily-rewards player family, and the daily-rewards ops family onto RouteDefs behind the shared spine, parity-clean under the canonical PARITY-FIRST PROSE rule (legacy bodies byte-for-byte; coded emission is Phase 22), with every family keeping its legacy ladder arm as the flag-off rollback path until Phase 25.

STEP 0 - PRE-FLIGHT
- Verify `git status` is clean. Shared worktree, concurrent sessions; if dirty, STOP and ask. Stage only your files with EXPLICIT paths later, never `git add -A`.
- Scan Claude Code memory for: "Server API pipeline audit" (locked decisions), "Phase 18 oauth+internal" (the composite delegate + require_internal_secret + the dual-edit maintenance rule), "API-pipeline HEAD parity gotcha" (HEAD delegates to legacy; a deviation MASKS its whole path, re-pin with captureBothModes), "Release merges into the branch" (mirror rule for dual-served routes), "Lazy db-bundle vs partial mock", "Phase 17 admin" (the auth-mounting sweep mandate every new authed surface inherits).

STEP 1 - LOAD CONTEXT (do NOT read planning docs directly; spawn ONE Explore agent)
Tell the Explore agent to summarize, anchored on SYMBOL NAMES and ROUTE STRINGS (never line numbers):
- docs/api-pipeline/state.md + progress.md (Phases 1-18 shipped surface; the canonical PARITY-FIRST rule; the Phase 18 composite-delegate and off-table decisions this phase inherits).
- docs/api-pipeline/phase-18b-late-arrivals.md (this file).
- server/github.ts: handleGithubStart/Callback/Status/Unlink (or the actual symbol names), githubRateLimited, and the main.ts arms for POST /api/auth/github/start, GET /api/auth/github/callback (HTML), GET /api/github, DELETE /api/github. Note auth per arm (start/status/unlink are bearerActiveAccount-gated in the ladder; callback is public HTML) and whether isIpBlocked appears anywhere in the family (Phase 16 closed that gap for Discord; report github's ground truth, do not assume).
- server/desktop_login.ts: handleDesktopLoginExchange plus the create core (issueDesktopLoginCode since the 18b scope fix; it replaced the pre-18b handleDesktopLoginCreate, which resolved its own bearer), createDesktopLoginCode/consumeDesktopLoginCode (the in-process single-use IP-bound code Map, per-realm, restart-lossy), DESKTOP_LOGIN_TTL_MS, the deps object main.ts injects, and the main.ts arms plus the FUSED per-IP rateLimited condition they share with /api/register + /api/login (one budget, limiter BEFORE auth).
- server/daily_rewards.ts: handleDailyRewardApi (GET status / POST spin / GET history; in-family 404 'unknown endpoint'), handleDailyRewardInternalApi (the /internal/daily-rewards/ prefix family: POST pending-payouts / payout-history / mark-payout), internalAuthorized + secretsMatch (x-woc-daily-reward-secret vs WOC_DAILY_REWARD_SERVICE_SECRET, per-request read, FAIL-CLOSED 401 on unset env AND on mismatch, never falls back to RESTART_COUNTDOWN_SECRET), dailyRewardService (the singleton game.ts calls directly for online/quest/arena credit: it must stay importable independent of routes), the config fetch (WOC_DAILY_REWARD_SERVICE_URL, per-day cache, WOC_DAILY_REWARD_CONFIG_TTL_MS), pickSpinOutcome (Math.random, legal in server/), and the main.ts prefix arm `startsWith('/api/daily-rewards')` gated by bearerActiveAccount BEFORE delegating (method- and subpath-agnostic).
- server/main.ts: the four ladder arms above, the internalLegacy composite delegate (handleDailyRewardInternalApi tried FIRST, short-circuits; handleInternalApi is terminal so the ordering is load-bearing and parity-pinned), and the desktop-login deps wiring.
- The spine + prior templates: server/http/middleware/bearer_active_guard.ts (createActiveGuard: byte-identical to bearerActiveAccount, the Phase 15 extraction), require_internal_secret.ts (the two existing header/env pairs and the feature-off 404 vs this family's fail-closed 401), registry.ts, dispatch.ts (delegation semantics), known_deviations.ts (reportsBodyValidationRemap / internalBodyValidationRemap / oauthInternalOffTable405 as the deviation models), and server/discord.ts routes (the Phase 16 template for an OAuth-link family incl. the callback meta.envelope 'html').
- tests/server/http/: surface_inventory.ts (the 12 rows already filed: github x4, desktop-login x2, daily-rewards x6 incl. AUTH_SCOPE.secretDailyReward), completeness.test.ts (MIGRATED_ROUTES is hard-coded per phase; the Phase 18 block excludes the ops family from the internal pins and pins it delegate-only: this phase FLIPS those pins), ownership_coverage.test.ts (the internal secret-gate mounting sweep: gatePairFor knows only the deploy/discord pairs and its two-case contract [env-unset 404 / wrong-secret 401] does NOT match the daily-reward gate's fail-closed 401/401: extend with the third pair + a per-gate expected-body fork), parity.test.ts (the composite-ordering pin already exists: env-unset fail-closed 401 beats the ladder 404).
- src/main.ts userFacingApiError (the desktop-login prose arm errors.api.desktopCodeInvalid already exists) and src/net/online.ts dailyRewards()/spinDailyReward()/dailyRewardHistory() (raw fetch, bodies mostly discarded client-side; no matcher arm needed this phase, Phase 22 records the adjudication).
- server/CLAUDE.md + root CLAUDE.md.
Return: a symbol-anchored map of the twelve handlers and their dispatch, the auth/limiter/body/envelope contract per route, the composite-delegate semantics, the createActiveGuard and requireInternalSecret signatures, the deviation models, and which harness pins this phase must flip. No code, just the map.

STEP 2 - MAINTAINER FORK (ask BEFORE porting; do not silently choose)
- Desktop-login create auth scope: the legacy arm resolves the bearer via the scope-blind accountForToken while exchange mints a full-scope session token; the scope-checked resolver (accountAndScopeForToken, which bearerActiveAccount uses to 403 read-only tokens on every other mutating route) exists precisely to prevent a read-scope token acting as full. Ask the maintainer: (a) PARITY (reproduce accountForToken in a custom guard, document the scope behavior as a knownDeviation-style note) or (b) FIX (createActiveGuard on create, so read-scope tokens 403 'this token is read-only'; a behavior change needing a knownDeviation + a mirror edit in the LEGACY arm too, since the route is dual-served until Phase 25 and the fix is only real if both paths enforce it). RECOMMEND (b): the browser /desktop-login page always holds a full-scope session token, so no legitimate caller regresses. If (b), land the legacy-arm edit in the same change and pin both paths.
- Daily-rewards spin limiter: legacy has NO limiter (the one-spin-per-day 409 is the only guard). Parity-first says add none; Phase 19 owns the POLICIES decision. Confirm the maintainer wants no limiter this phase (flag it to Phase 19 in the doc updates).

STEP 3 - CHOOSE ORCHESTRATION + EXECUTE
Hand-spawn parallel agents on INDEPENDENT files only (the prior-phase clobber lesson: the lead implements the coupled core myself: registry spread, main.ts, shared harness edits). Suggested split:
- Lead (coupled core): the four `export const routes: RouteDef[]` blocks (github.ts, desktop_login.ts, daily_rewards.ts x2 families), registry.ts spreads, any configure<Domain>Runtime boot wiring in main.ts, the require_internal_secret fail-closed variant, knownDeviations entries, and the harness pin flips (completeness, ownership_coverage, parity re-pins).
- Agent A (tests): tests/server/github.test.ts (mirror discord.test.ts: fakeCtx + compose-driven runRoute + the callback html-envelope contract).
- Agent B (tests): tests/server/desktop_login.test.ts (both routes through the real chain; the fused limiter ordering: 429 BEFORE auth; the fork outcome pinned on BOTH paths; the exchange bad-JSON deviation pin).
- Agent C (tests): tests/server/daily_rewards_routes.test.ts (player trio + ops trio through the real gate+handler chains; the fail-closed gate cases; the mark-payout validation branches; the delegate-ordering pin stays green).
PORTING RULES (parity-first, per family):
- github: 4 RouteDefs in server/github.ts mirroring Phase 16 discord.ts exactly: callback carries meta.envelope 'html' (an escaping throw must serialize as HTML, never problem+json); start/status/unlink keep githubRateLimited legacy prose; auth via createActiveGuard where the ladder used bearerActiveAccount. The github arms are ALSO bare `return` inside handleApi's try (main.ts start/status/unlink), so their unexpected-throw counterfactual is the same HANG class; the github deviation entry documents that, not an outer-catch 500. Do NOT add isIpBlocked/turnstile unless ground truth shows the family already has it (a security widening is a maintainer fork, not a silent add).
- desktop-login: 2 RouteDefs in server/desktop_login.ts; the FUSED per-IP rateLimited budget shared with register/login must stay ONE bucket with limiter-before-auth ordering (Phase 14 fused-limiter precedent; splitting per-route would change register/login budgets). exchange self-reads its body => `desktopLoginBodyValidationRemap` deviation whose legacy counterfactual is a request HANG, not a response: the ladder arms are bare `return handler(...)` with no await inside handleApi's try (the return-await pitfall), so a readBody bad-JSON reject or any unexpected throw escapes the outer catch as an unhandled rejection with no response written, exactly the internalBodyValidationRemap class (contrast the arms that DO `return await`: site-presence, perf-report). The new path's 500 + X-Request-Id is a flag-gated reliability improvement. The in-process code Map stays module-owned; deps become injected runtime.
- daily-rewards player: 3 RouteDefs in server/daily_rewards.ts, createActiveGuard (byte-identical 401/403 prose to the ladder's bearerActiveAccount), NO withBody anywhere (spin never reads a body; adding a body reader would invent 400/413 behavior legacy does not have), history's limit query stays lenient (Number(...)||30; a strict 422 breaks parity, the Phase 10 lesson). Deviation `dailyRewardsBodyValidationRemap`: an unexpected throw serializes as the api-surface 500 + X-Request-Id, where the legacy counterfactual is a request HANG (the arm is a bare `return handleDailyRewardApi(...)` with no await inside handleApi's try, so a rejection escapes the outer catch as an unhandled rejection; same class as internalBodyValidationRemap and the desktop-login pair, a flag-gated reliability improvement). The prefix-arm oddities stay delegate-served until Phase 25: wrong method / unknown subpath / the no-slash '/api/daily-rewardsX' shape resolve unmatched and delegate to the ladder's auth-then-404; HEAD delegates per the standing rule. NO runtime injection needed (the handlers touch only dailyRewardService + db reads; game.ts keeps calling the singleton directly).
- daily-rewards ops: 3 RouteDefs surface 'internal' + meta.envelope 'admin'. The gate is a FAIL-CLOSED variant of requireInternalSecret (a `failMode: 'closed401'` option or a sibling factory; per-request env read, length-guarded timingSafeEqual, never falls back to RESTART_COUNTDOWN_SECRET, never logs the secret): env-unset AND wrong-header both answer 401 {success:false,data:null,error:'not authenticated'}, never the other pairs' feature-off 404. Deviation sibling of internalBodyValidationRemap for mark-payout's un-caught readBody + all three DB throws (legacy counterfactual: the composite has NO outer catch, the request HANGS; the new path's admin-shape 500 is a flag-gated reliability improvement). The legacy family auths the WHOLE prefix BEFORE path/method resolution; on the table each route auths after path match, which is invisible while the composite delegate serves the unmatched remainder: record the Phase 25 handoff (the family-wide pre-path 401 must be recreated or its loss adjudicated at ladder deletion, alongside oauthInternalOffTable405). The composite ordering (daily-rewards tried first) stays load-bearing for every off-table shape until Phase 25: do NOT touch internalLegacy.
HARNESS FLIPS (the lead owns these):
- completeness.test.ts: MIGRATED_ROUTES += the 9 /api routes (method-aware); the Phase 18 block's ops-family pins FLIP from delegate-only/notFound to registered (the opsFamilyRows filter and its .toBe(3) stay; the 'leaves delegate-only' test becomes 'registers the ops family' with the synthetic never-existing subpaths still notFound); the internal registers-exactly derivation now includes the ops rows (11 -> 14).
- ownership_coverage.test.ts: the internal sweep gains the third (header, env) pair + a per-gate expected-body fork (this family: 401 on BOTH cases) + count 11 -> 14; the /api auth-mounting sweep (Phase 17 mandate) gains github start/status/unlink, desktop-login create (per the fork outcome), and the 3 player daily-rewards routes: every authed route driven unauthenticated through the REAL chain must 401 before the handler, plus the negative control stays.
- parity.test.ts: captureBothModes re-pins for every path a new deviation masks (the head-parity gotcha: a deviation masks its WHOLE path in the path-scoped filter); the existing composite-ordering pin and the oauth/internal blocks stay green; add db-free pins where available (player trio no-Authorization 401; ops fail-closed 401; desktop-login 429 shape; github callback byte-identical through both modes).
- characterization goldens: BACKFILL write-if-absent goldens for the db-free contract points of all 12 routes (the daily-rewards-winners precedent: these routes postdate the Phase 3 capture, so freeze the legacy contract on disk BEFORE the Phase 25 flip).

INVARIANTS THIS PHASE MUST KEEP
- PARITY-FIRST PROSE: every migrated handler writes the LEGACY body byte-for-byte on every branch; the client prose-matcher keys on them; coded emission is Phase 22. No error_codes.ts append this phase.
- ROLLBACK-RETENTION: every migrated route stays BOTH router-owned under API_DISPATCH 'new' AND legacy-served until Phase 25; no ladder arm is deleted here.
- The dual-edit MAINTENANCE RULE extends to every route this phase dual-serves: until Phase 25 any behavior edit lands in BOTH the ladder branch (or sub-dispatcher) and its RouteDef twin.
- The /internal composite delegate ordering is untouched; the ops family's fail-closed 401 semantics are preserved exactly (no 404-feature-off softening, no RESTART_COUNTDOWN_SECRET fallback).
- Auth-gated legacy-body middleware, NOT problem+json requireAccount, on every ported route (createActiveGuard / the custom guards); self-read bodies stay self-read (no withBody anywhere in these families).
- The fused register/login/desktop-login per-IP budget stays ONE bucket, limiter before auth.
- dailyRewardService stays importable and callable by game.ts independent of any route table state.
- Server-only: no src/sim/, no WS wire, no IWorld change. i18n: NO new player-visible strings and NO translations (all prose is frozen legacy English the client matcher/UI already handles; Phase 22 owns codes).
- No em dashes, en dashes, or emojis anywhere. Conventional Commits, explicit paths.

OUT OF SCOPE (do not let these creep in)
- Rate-limiter rework, POLICIES rows, or any NEW limiter incl. a spin limiter: Phase 19 (hand it the fork outcome).
- Coded emission, apiError.* catalog entries, matcher rework, or adjudicating the daily-rewards prose family's client handling: Phase 22 (the audit's client report is in state.md; the window discards bodies today).
- Security headers / Origin / 415 enforcement on these routes: Phase 21 (landing this phase makes them visible to its RouteDef-driven gates).
- The oauth GET HTML pages + restart-countdown wrong-method shape: the existing oauthInternalOffTable405 deviation directs Phase 25.
- The secretsMatch triplication (now internal.ts + require_internal_secret.ts + daily_rewards.ts): dedup stays deferred to Phase 25 (import-cycle rationale, Phase 18 adjudication); the fail-closed variant may add a FOURTH copy only if reusing the middleware's helper truly cycles: prefer reuse.
- env/config consolidation (WOC_DAILY_REWARD_* reads): Phase 24.

STEP 4 - VALIDATION + MULTI-AGENT REVIEW
- `npx tsc --noEmit`
- `npx vitest run` on: the three new test files, tests/server/http/{surface_inventory,completeness,ownership_coverage,parity,known_deviations,dispatch}.test.ts, both characterization suites, and any existing github/desktop/daily suites the Explore agent names.
- Full `npm test`, `npm run ci:changed` (changed files only, never whole-tree --write), `npm run build:server`, `npm run build`.
- perl -CSD dash/emoji scan over all added lines.
- Dispatch reviewers per the diff surface: privacy-security-review (the fork outcome, the fail-closed gate, the shared limiter, no secret logging, the github OAuth state) and qa-checklist ALWAYS; migration-safety only if any DDL/JSONB surprise surfaces (none expected: the daily_reward_* DDL is already wired); cross-platform-sync + architecture-reviewer NOT dispatched unless the diff unexpectedly touches a matcher/wire/sim file.
- Truncation-resume line for every reviewer; resume truncated reviewers via SendMessage, never re-spawn cold.
Do NOT commit until each dispatched reviewer reports no BLOCKING.

STEP 5 - ACCEPTANCE CRITERIA (verifiable)
- [ ] All 12 routes resolve 'matched' through apiRegistry under API_DISPATCH 'new' and byte-identical to their legacy arms on every db-free branch (parity pins), with the ladder arms intact under 'legacy'.
- [ ] The maintainer fork on desktop-login create is resolved, implemented on BOTH serving paths, and pinned by tests (whichever branch was chosen).
- [ ] The ops family gate is fail-closed 401 on unset env AND wrong header via the new require_internal_secret variant, per-request env read, timing-safe, no fallback secret; the composite-ordering parity pin stays green.
- [ ] github callback and its escaping-throw path serialize as HTML (meta.envelope 'html' contract test), never problem+json.
- [ ] The fused register/login/desktop-login budget is one bucket, limiter-before-auth, pinned.
- [ ] No withBody on any of the 12 routes; spin provably reads no body; history's lenient limit decode pinned.
- [ ] knownDeviations gains the *BodyValidationRemap-class entries this phase warrants (github, desktopLogin, dailyRewards player, dailyRewards ops; ALL are hang-counterfactual per the bare-return pitfall above, possibly folded into fewer entries where the prose is shared) and every masked path is re-pinned via captureBothModes. NOTE: `introducedInPhase` is an integer the ledger bounds to the 25-phase plan; record these as introducedInPhase 18 with the entry prose naming Phase 18b (or widen the bound deliberately), do not invent a non-integer value.
- [ ] completeness (MIGRATED_ROUTES, the flipped ops pins, 11 -> 14), ownership_coverage (third gate pair + auth-mounting sweep additions), characterization backfills: all green; full suite green.
- [ ] The audit-filed corpus rows (12) and API_CONTENT_TYPE entries are consistent with the shipped RouteDefs (freshness + classification gates green).

STEP 6 - DOC UPDATES + MEMORY
- docs/api-pipeline/progress.md + state.md: record the phase (scope, fork outcomes, deviations, harness flips) and hand Phase 19 the limiter facts (shared budget preserved; spin still unlimited by decision) and Phase 25 the reduced off-table set (oauth GET pages + restart-countdown wrong-method + the daily-rewards prefix-arm oddities).
- Memory: record the fork outcome, the fail-closed gate variant, and any surprising ground truth (e.g. github isIpBlocked status).

STEP 7 - FINAL RESPONSE FORMAT
Report: phase status; files touched (absolute paths); per-command validation results; reviewer verdicts; fork outcomes; deferrals (Phase 19 limiter, Phase 22 codes/matcher, Phase 24 config, Phase 25 off-table handoffs); one-line handoff to "Phase 18b QA (docs/api-pipeline/phase-18b-qa.md)".

STOPPING RULES (stop and surface, do not push through)
- Stop if any migrated route's parity capture diffs without a documented knownDeviation.
- Stop if the maintainer fork cannot be resolved (do not pick silently).
- Stop if the ops-family gate would soften to 404-feature-off, gain a fallback secret, or the composite ordering would change.
- Stop if the fused limiter would split into per-route buckets, or any route would gain withBody / a new limiter / an error-code emission (all later phases).
- Stop if the github callback would serialize problem+json on any branch.
- Stop if a harness flip would weaken a Phase 10-18 pin instead of extending it.
````
