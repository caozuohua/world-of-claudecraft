# Bank System: Progress

## Status table

| Phase | Status | Started | Completed |
|---|---|---|---|
| Phase 1: sim bank core | complete | 2026-07-05 | 2026-07-05 |
| Phase 1 QA | complete | 2026-07-06 | 2026-07-06 |
| Phase 2: banker NPCs | complete | 2026-07-06 | 2026-07-06 |
| Phase 2 QA | complete | 2026-07-06 | 2026-07-06 |
| Phase 3: IWorld + wire | complete | 2026-07-06 | 2026-07-06 |
| Phase 3 QA | complete | 2026-07-06 | 2026-07-06 |
| Phase 4: lease + ledger | complete | 2026-07-06 | 2026-07-06 |
| Phase 4 QA | complete | 2026-07-06 | 2026-07-06 |
| Phase 5: bank window | complete | 2026-07-06 | 2026-07-06 |
| Phase 5 QA | complete | 2026-07-06 | 2026-07-06 |
| Phase 6: deposit + search | complete | 2026-07-06 | 2026-07-06 |
| Phase 6 QA | complete | 2026-07-06 | 2026-07-06 |
| Phase 7: mobile + a11y | complete | 2026-07-06 | 2026-07-06 |
| Phase 7 QA | complete | 2026-07-07 | 2026-07-07 |
| Phase 8: bonus slots | complete | 2026-07-07 | 2026-07-07 |
| Phase 8 QA | complete | 2026-07-07 | 2026-07-07 |
| Phase 9: final whole-feature QA | not started | | |

## Per-phase deliverable checklists

### Phase 1: sim bank core
- [x] `src/sim/bank.ts` module behind SimContext (state on Sim/PlayerMeta as live ctx views; thin delegates on Sim; zero rng draws)
- [x] Character state fields (`bank` container: inventory + purchasedSlots + bonusSlots) with serialize/load + back-compat defaults via `sanitizeBankState` + `cloneInvSlot` deep-clone at boundaries
- [x] Deposit/withdraw/buy-expansion logic with the full locked rule set (quest-kind deny, instanced no-merge, capacity pre-checks both directions, refusals move nothing and charge nothing, non-refundable purchases, expansion price table as data)
- [x] Move helpers are container-agnostic pure functions (`moveBetweenContainers` over lists + budgets, no hardcoded containers; the guild-bank/loadout seam, state.md decision 16)
- [x] Capacity math: base 24 + purchased blocks + bonusSlots field (bonus stays 0 until Phase 8)
- [x] `tests/bank.test.ts` (41 tests): rule matrix, exact deny literals, conservation invariant seed sweeps (50 seeds, five non-vacuity flags), determinism (300-tick run() equals run()), persistence round-trip + back-compat + tampered-save sanitization; decisiveness proven by an 8-mutation planted-bug pass (all killed)
- [x] sim_i18n matcher entries for every new emit (5 EXACT keys + zh_CN/zh_TW/ja_JP/ko_KR/ru_RU fills, M16) + S3 simSrc list append (same change)

### Phase 1 QA
- [x] Deliverables and acceptance criteria verified; coverage/dead-code/cleanup agents run; findings fixed

### Phase 2: banker NPCs
- [x] Three banker NpcDefs (Eastbrook, Fenbridge, Highwatch hubs) with `banker: true`, greetings, placement (`bursar_fernando` at {13,8}, `bursar_petra_vell` at {12,303}, `bursar_aldous_crane` at {-12,663}; Eastbrook renamed from the planned bursar_hobb at the maintainer's request, a deliberate easter egg)
- [x] Interaction arm: `{type:'bank', pid}` SimEvent from both interact() arms, `bankerIds` anchor list (Sim field + SimContext primitive), `INTERACT_RANGE + 2` proximity validation inside the sim on every bank command (the HUD gossip row itself is Phase 5 per the packet's out-of-scope list; the NpcDef flag it keys off shipped here)
- [x] Entity i18n lists + guide regen (`npm run wiki:content` produced NO diff: bankers are not delve keepers, so the generator ignores them; no `guide.*` prose keys needed)
- [x] Sim tests: proximity open/deny, event emission, anchor-list behavior (bank.test.ts 42 -> 58)

### Phase 2 QA
- [x] Deliverables and acceptance criteria re-verified independently (parity + golden audit, event/proximity/i18n/guide, in-world visual placement); findings fixed; 8-mutation decisiveness pass all killed

### Phase 3: IWorld + wire
- [x] `src/world_api/bank.ts` facet; IWorld extends list; COMMAND_FACETS tags
- [x] `bank_deposit` / `bank_withdraw` / `bank_buy_slots` in COMMAND_NAMES; validated dispatch cases; ClientWorld cmd() senders; HEAVY_SELF_CMDS membership
- [x] Proximity-gated bank info read riding a maybe() delta key; TERSE_TO_IWORLD; delta-guarded applySnapshot mirror
- [x] All pin bumps in the same commits (world_api_parity 185/50/135 + facets 23, command_schema 122/131, snapshots 32, command_facets)
- [x] Wire round-trip tests (fakeWs server + bare ClientWorld) + offline/online behavior parity test; plus the Phase 1 parity debt closed (META_EXCLUDE bank removed, goldens regenerated with rng byte-identity, bank_round_trip scenario added)

### Phase 3 QA
- [x] Deliverables and acceptance criteria re-verified independently (pins re-derived from source, delta-guard and dispatch validation traced, wire tokens grepped repo-wide); findings fixed; both should-fix tests mutation-proven

### Phase 4: lease + ledger
- [x] Per-character load lease at join (lease row + expiry + heartbeat + nonce fence, recorded in state.md decision 11); awaited fenced release on leave; takeover path safe; shutdown sweep; fail-closed refusal reusing the existing 'character already in world' literal (zero new i18n)
- [x] `bank_ledger` additive DDL (container discriminator columns per decision 16) + non-blocking observational writer (bankInfoFor snapshot diff) for every successful bank op
- [x] `scripts/bank_audit.mjs` offline conservation checker (per-container grouping; exit 1 on findings), plus `bank_audit.d.mts` for strict-tsc test imports
- [x] Tests: lease SQL semantics + ws handshake branches + game wiring (24), ledger diff/dispatch/SQL (23+), audit fixtures (4), schema_wiring pins; live dev-Postgres verification of the SQL semantics, the nonce fence, double-boot, and both audit exit paths

### Phase 4 QA
- [x] Deliverables and acceptance criteria re-verified independently (six audit streams incl. live dev-Postgres re-verification); all should-fix applied; full record in state.md

### Phase 5: bank window (desktop)
- [x] `src/ui/bank_view.ts` pure core (UI_PURE_CORES registered) + `src/ui/bank_window.ts` painter (PainterHostPresentation composition, no raw hex, quality tokens)
- [x] Open via the `bank` SimEvent; banker docking with bags (body.bank-open, new desktop side-by-side CSS); auto-close on leaving banker range (bankInfo null-gate, see the in-phase amendment in state.md); Esc routing via closeManagedWindow
- [x] Withdraw clicks (+ shift partial via a quantity prompt), capacity header, buy-slots confirm prompt in `#prompt-stack`
- [x] hudChrome.bank.* keys (16, five non-Latin fills each, M16); tests/bank_view.test.ts (13) + tests/bank_window.test.ts (20 source-scan pins)

### Phase 5 QA
- [x] Deliverables and acceptance criteria re-verified independently (adversarially-verified finder workflow + fresh qa-checklist + both smokes + a new escape peel probe); all should-fix applied, 4-mutation decisiveness pass all killed; full record in state.md

### Phase 6: deposit + search
- [x] Deposit mode inserted into BagMode + bagItemAction + bagTooltipHintKey together; deps flag on BagsWindowDeps
- [x] Deposit-all-materials button; shift-click partial deposits
- [x] Bank search/category/sort (bag_filter model; localStorage persistence)
- [x] View-core and painter tests

### Phase 6 QA
- [x] As Phase 1 QA

### Phase 7: mobile + a11y
- [x] Mobile 50/50 split with bags, safe areas, 40x40 tap targets, 16px inputs, pan-y grid scrolling, long-press tooltip peek behavior
- [x] Focus contract (non-modal companion cluster; prompts own their Tab cycle; inert clearing on every teardown)
- [x] i18n polish: M16 non-Latin fills for wordy strings (audit found zero missing; no new keys this phase); mobile screenshot verification at phone + tablet

### Phase 7 QA
- [x] As Phase 1 QA

### Phase 8: bonus slots
- [x] Server entitlement calculator as an extensible source registry (email VERIFIED via `accounts.email_verified_at IS NOT NULL`, Discord link row, wallet link row, qualified referrals: referee has a level >= 10 character, cap 5) stamped into character state at load via the ws_auth fresh-join arm -> game.join meta bag -> `addPlayer` `bankBonus` opt; offline default 0 (`server/bank_entitlements.ts` + `bankBonusFactsForAccount` in `server/db.ts`, one parameterized round trip)
- [x] Registry extensibility proven by test (a fake future connect-and-follow row appended over a registry copy lands as one more breakdown row with no wire-shape or pin churn; X/Twitch doc-commented as approved-but-blocked, not implemented)
- [x] Referral qualification query on the existing referrals table (no rebuild; capture untouched; realm-agnostic; denormalized `characters.level`)
- [x] Player-facing surface listing bonus sources and status (DECIDED: bank window footer; breakdown rides `BankInfo.bonusSources` on the existing proximity-gated bank delta; 13 `hudChrome.bank.bonus*` keys with five non-Latin fills; unknown future ids skipped)
- [x] Tests: entitlement math per source, the cap at exactly 5, the qualification SQL pins, stamp-at-load both directions, shrink-below-used over-capacity without loss, offline/no-stamp arm, pre-bonusSlots back-compat, the registry-vs-sim-clamp tripwire (plus the deferred Phase 1 `bonusSlots` upper clamp, closed: `BANK_MAX_BONUS_SLOTS = 16`)

### Phase 8 QA
- [ ] As Phase 1 QA

### Phase 9: final whole-feature QA
- [ ] Full `qa-checklist.md` matrix green; `npm run gate` green; packet teardown offered

## Notes per phase

(Fill in after each phase: deferrals, surprises, drift.)

### Release merge 2026-07-06 (before Phase 3)

- Merged origin/release/v0.22.0 (63 commits, tip 2b6519497) as b660fccb9. All 50 conflicts were generated artifacts, resolved by regeneration only: npm run i18n:gen for the i18n pair, UPDATE_PARITY=1 for 48 goldens (regenerated goldens keep the +3 banker entities on top of release sim changes; parity 96/96 without UPDATE). The i18n resolved-table sha256 baseline needed a re-write (scripts/i18n_resolved_hash.mjs --write): the merge is not behavior-preserving for i18n, so the re-baseline is correct, not a bug.
- release-merge-audit verdict: CLEAN both directions (three-way diff-of-diffs on every dual-touched file; banker flag flow re-verified end to end; no release-side bank/vault pre-landing; no command/delta-key/facet collisions). Only findings: stale pin baselines in state.md and the phase-03 packet, corrected in this commit. Release side notes: the merge brings the #1483 mobile-controls revert and 7 archetype IWorld members; ClientWorld has 7 adjacent archetype STUB members awaiting their own wire phase (do not wire them in bank work). A release-side oddity (inert CharacterState.worldBossDaily declared under a comment saying it was dropped, src/sim/sim.ts ~963) predates the merge and belongs upstream, not in bank commits.

### Phase 1 (2026-07-05)
- Reviewers: architecture-reviewer, migration-safety, qa-checklist all returned ZERO blocking; every should-fix and nice-to-have applied (Math.floor price-index hardening, `CharacterState.bank?: BankState` type reuse, deposit-side un-credit test, bonusSlots clamp deferral documented).
- Parity: the new `PlayerMeta.bank` field entered the sampled trace, so `bank` was added to `META_EXCLUDE` (pin updated in harness.test.ts); goldens byte-untouched. DEBT: Phase 3 must remove the exclusion and pin the bank in parity scenarios when it goes on the wire.
- Surprise: every content collect-objective item is quest-kind today, so the deposit-side quest un-credit path is unreachable through real content; it is pinned with a synthetic quest injection in the test and stays as defensive wiring for future content.
- Rollout: forward-only (a pre-bank binary drops the field and banked items are unrecoverable); drain or upgrade realms, never mixed binaries. Full outcome record in state.md "Phase 1 outcomes".
- Next: run docs/bank-system/phase-01-qa.md in a fresh session.

### Phase 2 (2026-07-06)
- Reviewers: architecture-reviewer (0 blocking, 0 should-fix, 4 notes), cross-platform-sync (0 blocking, 4 nits, all deferred-phase handoffs), qa-checklist (READY, 1 should-fix: targeted-far interact test, applied same-session as test 58). Every finding applied or recorded in state.md Phase 2 outcomes.
- PARITY GOLDENS REGENERATED (user-approved in-phase): three ctor-placed NPCs shift every later entity id by +3, so "goldens byte-identical" is unachievable for any world-entity addition. Independent audit (script + architecture-reviewer re-verification): all 48 changed goldens are a pure +3 id-family offset, rng draw digests and counts byte-identical, zero anomalies. Landed as its own test(parity) commit per tests/parity/CLAUDE.md. The packet acceptance criterion was amended accordingly.
- Easter egg: the Eastbrook banker is Bursar Fernando (bursar_fernando), renamed mid-phase from the planned bursar_hobb at the maintainer's request. All phase docs, i18n keys, and translations re-keyed; repo-wide grep for the old id is clean (the historical provenance notes in the bank-system docs, five mentions across state.md, phase-02-banker-npcs.md, and this file, are deliberate).
- Deferral: an in-world visual placement check of the three bankers (overlap/geometry) needs a running client; deferred to the Phase 2 QA session.
- Next: run docs/bank-system/phase-02-qa.md in a fresh session.

### Phase 3 (2026-07-06)

- Executed right after the v0.22.0 release merge (see "Release merge 2026-07-06" above); pin baselines re-derived from the merged tree before any edit (the packet's literals were stale, corrected in cdda401ea).
- Two parallel implementation agents (facet+server / client+pins+tests) converged with zero reconciliation needed (wire field names, BankInfo shape, and delta key all locked up front). Full record in state.md "Phase 3 outcomes".
- Reviewers: privacy-security-review PASS (0 findings), cross-platform-sync CLEAN (0 findings), qa-checklist READY (0 blocking, 0 should-fix), architecture-reviewer 1 should-fix (bankInfoFor read-boundary clone unpinned) applied same-session as 8a29fc43f and proven by a planted shallow-copy mutation.
- Commit cadence amended for per-commit greenness: feat(server) folded into the feat(net) commit (pins ride the seam commit), parity work in its own test(parity) commit. Four commits 711d767a2, d21cef8a9, 8a29fc43f, d402d1917.
- Deliberate non-change: no bespoke rate limiter for bank_buy_slots (no per-command precedent exists; blanket consumeMsgToken + exact escalating prices + hard cap suffice; recorded in state.md).
- Next: run docs/bank-system/phase-03-qa.md in a fresh session.

### Phase 1 QA (2026-07-06)
- Verdict: PASS after fixes. 1 blocking + 7 should-fix + 5 nice-to-have found; all applied except 3 refuted with evidence. `src/sim/bank.ts` survived QA byte-unchanged; every applied fix was test decisiveness, i18n accuracy, or merge damage. Full record in state.md "Phase 1 QA outcomes".
- The blocking was merge damage, not Phase 1: `17f311ca4` (release/v0.22.0 merge) committed unresolved conflict markers into the generated `src/ui/i18n.status.summary.json`; regenerated via `npm run i18n:gen` and committed.
- Planted-bug pass (acceptance criterion 1): 5/5 conservation mutations caught by the sweep itself, including the vacuity guard.
- `tests/bank.test.ts` grew 41 -> 42 tests and every refusal path now pins copper + both containers; the two generic persistence suites now cover the bank field.
- Next: run docs/bank-system/phase-02-banker-npcs.md in a fresh session.

### Phase 2 QA (2026-07-06)
- Verdict: PASS after fixes. 0 blocking + 4 should-fix + 5 nits/info found across seven audit streams (correctness, coverage, dead-code, architecture-reviewer, cross-platform-sync, qa-checklist, in-world visual check); all four should-fix and both doc nits applied same-session. Full record in state.md "Phase 2 QA outcomes".
- Fixes landed: dead-player gate on all three bank commands (the market/mail silent idiom; a dead player could previously deposit/withdraw/buy while the interact path was already dead-gated), `banker: true` preserved through the map-editor sanitizer (`sanitizeNpc` mirrored `market` but dropped `banker`), `bursar_petra_vell` re-authored {12,303} -> {9,303} (the authored spot sat inside the Fenbridge inn's collider and findSafePos silently relocated her 2.8 yd at spawn; the new coordinate spawns nudge-free and parity goldens are UNTOUCHED because hub NPCs are not tracked parity entities), and the reach boundary pinned with literal distances (7.0 succeeds, 7.05 refused).
- Independent re-verification: parity green with rng draws/digests byte-identical across all 48 goldens (779 checks, 3072 +3 id-shifts, zero anomalies); in-world visual placement PASS for all three bursars (screenshots; identity via nameplates/target frames).
- Decisiveness: 8-mutation planted-bug pass, all killed (per-command gates, both interact intercepts, ctor push, pid on the emit, radius widening, boundary inclusivity, dead gate).
- Phase 5 handoffs recorded in state.md: banker discoverability (no minimap marker or role hint yet) and whether to surface the greeting on bank-open; keep passing pid on the bank event.
- Next: run docs/bank-system/phase-03-iworld-wire.md in a fresh session.

### Phase 4 (2026-07-06)

- Two parallel implementation agents (lease / ledger+audit) on disjoint file regions of db.ts and game.ts converged with zero collisions; the orchestrator pre-locked the lease mechanism (state.md decision 11) and both DDL anchor points before fan-out. Full record in state.md "Phase 4 outcomes".
- Reviewers: migration-safety PASS (1 should-fix applied), privacy-security-review PASS (1 WARNING applied as the nonce fence + 1 INFO applied as WsAuthDeps DI), qa-checklist READY (1 should-fix + 1 nit applied). All INFO adjudications recorded in state.md; none deferred.
- Live dev-Postgres verification (not in the packet, kept as a practice): the real db.ts functions were bundled and run against the docker dev DB twice (pre- and post-fence), proving the SQL semantics mocks cannot (upsert refusal arms, nonce fence, advisory-lock double-boot, JSONB round-trip, audit exit codes). It caught one real bug the unit fixtures had modeled wrong (the audit skipped bankless-state characters with ledger activity); fixed and pinned same-session.
- Commit cadence amended (recorded in state.md): tests split from the scripts commit for conventional-commit hygiene; mock-factory repairs ride the commit that breaks them.
- Next: run docs/bank-system/phase-04-qa.md in a fresh session.

### Phase 3 QA (2026-07-06)
- Verdict: PASS after fixes. 0 blocking + 2 should-fix + 1 nit + 6 INFO across seven audit streams (correctness, test-coverage, dead-code, architecture-reviewer, cross-platform-sync, privacy-security-review, qa-checklist); everything actionable applied same-session as 9e6cc30e1. Full record in state.md "Phase 3 QA outcomes".
- Preceded by the origin/main merge a210b96d4 (mobile reverts + desktop fixes; conflicts only the generated i18n pair, regenerated and verified to parse).
- Every pinned count re-derived from SOURCE matched (185 = 50 + 135, facets 23, send 122, dispatch 131 with dispatch-only 9, delta keys 32 on both encoder and decoder); no pinned list loosened or reordered.
- Fixes: explicit-null bank snapshot now applied to a ClientWorld and the mirror proven to CLEAR (mutation-proven; a truthy decode guard previously survived the suite), nextExpansionCost null arm at the 12-expansion cap exercised (mutation-proven), merged stack asserted on the wire, the non-number count coercion pinned as contract, src/CLAUDE.md type-only edge wording widened to sim/bank.ts.
- INFO adjudications recorded in state.md (NaN-at-dispatch idiom, outbound-size precedent, spec-mandated HEAVY_SELF_CMDS redundancy for buy): do not re-raise.
- Next: run docs/bank-system/phase-04-lease-ledger.md in a fresh session.

### Phase 5 (2026-07-06)

- Preceded by the release/v0.23.0 merge cd640c569 (desktop update-track split, admin evidence history; conflict only the generated i18n summary, regenerated; release-merge-audit CLEAN). Full record in state.md "Phase 5 outcomes".
- Two parallel implementation agents (view core + tests / painter + hud + CSS + i18n) on disjoint files converged with zero reconciliation (the view-core API was locked up front, the Phase 3 pattern).
- ONE approved packet amendment: auto-close is the mailbox bankInfo-null-gate, not a HUD distance loop (the bank event carries no npc id and the banker flag is not on the wire; the mirror nulls at 7 yd in both worlds, tighter than the 8 yd criterion).
- Verified end to end in BOTH hosts with headless-browser smokes: offline 23/23, online 20/20 (deposits/withdraw/partial/buy over the real wire, the unaffordable refusal line rendering, auto-close, play.html clean). Scripts kept in gitignored tmp/ for the QA session.
- qa-checklist: READY, 0 blocking; 1 should-fix (missing :focus-visible ring on the two new bank controls) + 1 nit (10vh -> --app-vh) applied same-session and pinned; INFO adjudications in state.md.
- Environment gotchas for browser smokes (first-spawn intro hides #ui in fresh profiles; realm picker + zero-char create-view flow; trader_wilkes vs the_merchant) recorded in state.md.
- Next: run docs/bank-system/phase-05-qa.md in a fresh session.

### Phase 5 QA (2026-07-06)

- Verdict: PASS after fixes. 0 blocking + 5 should-fix + 18 nit/INFO across five audit streams; every should-fix and three nits applied same-session (bdb1d6e67 bank + eed955066 bags family fix). Full record in state.md "Phase 5 QA outcomes".
- Preceded by the release/v0.23.0 merge 90caf42f2 (CI vitest de-flake + render door/portal extraction): ZERO conflicts, the first conflict-free merge on this branch; release-merge-audit CLEAN.
- Two real behavior defects fixed and live-proven: prompt Escape double-handling (one keypress on a prompt button closed prompt AND window; now stopPropagation, peel order prompt -> bags -> bank pinned by a new gitignored escape peel probe) and the withdraw-quantity stale-index hazard (submit now re-validates the live slot's itemId and clamps to the live count). Both inherited-recipe issues; bags got the same Escape fix in its own commit.
- Three mutation-proven vacuous pins tightened (grace-close action, both inert teardown arms, the hud deps wiring); 4 mutations re-run, all killed.
- Incidental find, pre-existing upstream, NOT ours: the opt-in axe browser suite's paperdoll test throws on a professionsState-less world stub (gathering HUD PR #1194, broken on release/v0.23.0 too; invisible to CI). Recorded for an upstream fix, not folded into bank commits.
- Next: run docs/bank-system/phase-06-deposit-search.md in a fresh session.

### Phase 6 (2026-07-06)

- Preceded by the release/v0.23.0 merge 6b1e37ead (Core Dev role PR #1546 + the deliberate revert of the CI vitest de-flake #1560; conflicts only the generated i18n trio, regenerated; release-merge-audit CLEAN). Full record in state.md "Phase 6 outcomes".
- The mode-chain order pin landed FIRST as its own commit (an all-modes-on cascade that forces any BagMode extension to declare its rung), then two parallel implementation agents (deposit mode / search + deposit-all) on disjoint files; the only shared files (catalog + five overlays) used distinct anchor regions and converged without collisions.
- Deposit lands as the atomic three-place change (bags_view rung after vendor, bags_window isBankOpen read per click, one hud.ts dep line): click deposits the exact clicked stack by reference index (never first-match-by-itemId), shift-click opens the QA-hardened partial prompt (stopPropagation + stale-slot re-validate + clamp), a quest item pre-empts with the sim's own deny line via tSim.
- Search/category/sort reuse the bag_filter vocabulary through a sibling pure bank_filter.ts that preserves original slot indices and matches the LOCALIZED name via an injected resolver (the recorded bags divergence); deposit-all is a pure planner over the sim's own moveBetweenContainers on clones, descending indices, one click-time snapshot, an in-flight double-click guard, and an in-window aria-live summary.
- Two live bugs found and fixed same-session: the slow-band repaint stealing search focus mid-typing (render() now carries focus + caret across full rebuilds) and the dead depositPartialHint key (wired as the withdraw twin). qa-checklist READY 0 blocking; every finding applied; offline smoke 21/21 (probe gotcha: smoke character names must be letters-only or the game silently never starts).
- Next: run docs/bank-system/phase-06-qa.md in a fresh session.

### Phase 6 QA (2026-07-06)

- Verdict: PASS after fixes. 0 blocking + 3 should-fix + 2 nits + 6 INFO across four audit streams (correctness, test-coverage-auditor, dead-code, the independent qa-checklist gate: READY); every should-fix and nit applied same-session (3b841b432). Full record in state.md "Phase 6 QA outcomes".
- Preceded by the release/v0.23.0 merge 1288d70f1 (professions signed-materials epic #1207): ZERO conflicts, release-merge-audit CLEAN; the bank was already instance-aware end to end, and a new integration test now drives a signed material through the real sim.bankDeposit (moves whole, never merges).
- The phase 6 handoff ONLINE smoke: 22/22 PASS against the authoritative server (deposit click, quest deny, shift-click partial prompt with Enter submit, search focus + caret, chip persistence, deposit-all with the in-flight guard observed disabled at send and the plan applying completely).
- One pre-existing product bug found via that smoke and fixed in its own commit (fe642f515): the first-spawn intro cinematic honored only the in-game reduceMotion switch, not the OS prefers-reduced-motion query (against the documented effective-flag model), and while running it inline-hides #ui so HUD focus() calls silently drop; the first online-smoke run failed 4 checks, all artifacts of this.
- Test hardening applied: the resolveDepositSubmit maxCount arm pinned with a grown-live-stack case; the deposit-all summary arm choice extracted into the pure depositAllSummaryKey and pinned per-arm; DEPOSIT_STATUS_MS = 4_000 pinned as a literal; the bagFilterIsDefault twins consolidated into one bag_filter.ts export.
- Shared-tree incident: a concurrent session flipped the worktree to release/v0.23.0 mid-QA; all four audit streams detected it and re-based on commit objects or throwaway worktrees; the branch was restored and the game-server bundle REBUILT before the online smoke (the esbuild bundle snapshots the checkout at server start).
- Battery: tsc, six bank/bags suites + architecture + S3, ci:changed, i18n:gen zero-diff, offline smoke 21/21, online smoke 22/22, and the full npm run gate, all green.
- Next: run docs/bank-system/phase-07-mobile-a11y.md in a fresh session.

### Phase 7 (2026-07-06)

- Preceded by the release/v0.23.0 merge f687de700 (the mobile-controls rework re-landing, PR #1525, plus the hotbar drag-drop tooltip fix #1564; conflicts only the generated i18n trio, regenerated; release-merge-audit CLEAN: every packet premise held, touch_peek.ts and the vendor pairing recipe intact). Full record in state.md "Phase 7 outcomes".
- Two parallel agents per the packet (mobile CSS + touch / a11y + i18n verification) on disjoint files, then the orchestrator applied the verifier's findings after the implementer landed. Three commits: 15c6ea6a7 (feat: pairing + standalone + undock/re-dock + cluster close + bank peek guard), 4afcb6ea1 (fix: the bags family peek suppression), 497edba11 (fix: keyboard activation guard + promptModalOpen gate + the prompt Enter/Space submit-dismiss race).
- The mobile pairing needed two things CSS alone could not do: a placeNewWindow bank-open cascade exemption (the inline cascade inset beats the docking layer) and the closeManagedWindow/x-btn cluster-close arms (the vendor family behavior). A bags-only close (tray toggle) UNDOCKS instead, so the bank widens to the standalone full-screen rule and regains its own x-btn; toggleBags re-docks.
- Two keyboard defects live-proven and fixed: Enter/Space on focused bank/bags buttons hijacked by the global chat/jump binds (guard-array fix), and the prompt Enter confirm opening chat + ghost-clicking the re-landed close button (prompt-level stopPropagation with isConnected-gated preventDefault, plus promptModalOpen() gating all three canUseGameKeys predicates). Keyboard walkthrough 39/39.
- The single-row scrollable-chips rule (bank cluster only) recovered the paired grid at 360px-tall phones (the two-row chip wrap left a sub-row sliver). Screenshots + 6/6 live checks at 740x360 and 1024x768 in tmp/p7_shots{,_tablet}/.
- i18n sweep: zero new keys needed, all 29 hudChrome.bank.* keys carry their five non-Latin fills, formatters verified end to end, ARIA names all t()-sourced. qa-checklist verdict READY, 0 blocking, 0 should-fix; full npm run gate green; mobile input-zoom check 28/28.
- Next: run docs/bank-system/phase-07-qa.md in a fresh session.

### Phase 7 QA (2026-07-07)

- Preceded by the release/v0.23.0 merge 581b6da5a (itemization epic #1471, professions #1209/#1210, mob pursuit #1570, the UI-scale and bags first-open UI fixes; conflicts: the generated i18n trio regenerated, bags_view.test.ts import union, 7 parity goldens re-minted from the merged tree; 13-auditor release-merge-audit CLEAN). Full record in state.md "Phase 7 QA outcomes".
- Five audit streams: qa-checklist READY 0/0; i18n/M16 and CSS streams zero findings; test-coverage-auditor 14/15 pins decisive (3 mutation-proven); correctness re-drove everything live (screenshots 6/6 at both viewports, all tap targets at or above 40x40 at two phone widths, peek suppression proven with plain-tap controls, keyboard walkthrough 39/39, and the ONLINE-host mobile spot-check handoff closed 6/6 against the live server).
- One real bug found and fixed family-wide: the mobile paired 50/50 split (bank plus the vendor cluster it mirrors) used raw 50vw, which the #ui zoom multiplies, so the halves gapped above uiScale 1 and overlapped below it; all four split lines now divide the shared --app-vw box by the live scale, live-verified GAP=0 at 0.85/1.0/1.4 for both clusters with a 6/6 default-scale regression. Follow-on: the standalone full-screen blocks (bank + family bags) now drop the base .window max-width clamp, which under-filled them below scale 1.
- QA fixes all applied: the chip-compaction rule got its missing test oracle, the consumePeek wiring pins are sliced per construction site, the cascade-exemption pin covers the return, and the peek probe waits for the tooltip to arm instead of a fixed sleep (de-flaked). One adjudication recorded: an executed-DOM bags peek unit test declined per the painter source-scan convention (the composite oracle stands).
- Docs: the stale Phase 7 status-table rows corrected; the src/ui/CLAUDE.md 16px-floor location drift closed (base.css, not index.html).
- Next: run docs/bank-system/phase-08-bonus-slots.md in a fresh session.

### Phase 4 QA (2026-07-06)

- Verdict: PASS after fixes. 0 blocking + 5 should-fix + 5 INFO across six audit streams (correctness, test-coverage, dead-code, migration-safety, privacy-security-review, qa-checklist); every should-fix and four INFO applied same-session, one INFO adjudicated. Full record in state.md "Phase 4 QA outcomes".
- Preceded by the release/v0.23.0 merge 89aede5d8 (conflicts only the generated i18n trio, regenerated and verified to parse; release-merge-audit CLEAN: the new t:'logout' handler composes with the lease release via leave()).
- One real race fixed test-first: planJoin no longer resumes a mid-teardown (left) session, closing the grace-expiry reconnect window where the nonce fence never engaged (zombie session + early lease release). The reject reuses the transient conflict literal, so the client retries into the fresh-acquire arm.
- Clean shutdown now drains the bank_ledger FIFO before pool.end(); the audit script dropped its unused account_id read; the four untested audit detector kinds, the pendingLeaseJoins guard clear (both arms), the logout-to-fenced-release composition, and the refused-at-banker zero-rows arm are all pinned, the two headline pins mutation-proven; tests/ip_block_kick.test.ts got the missed lease mock block.
- Harness note: the Fable usage-credit limit killed two audit agents and most refuter votes mid-workflow; both streams re-ran on opus/sonnet, unverified findings hand-verified per the standing gotcha. The dead-code stream re-verified the final tree: zero open findings, 150/150.
- Next: run docs/bank-system/phase-05-bank-window.md in a fresh session.

### Release merge 2026-07-07 (before Phase 8 QA)

- Merged origin/release/v0.23.0 (12 commits, tip 0b136a7be) as e561a89b8: bags right-click destroy #1569, 4-piece epic set procs #1583, Drowned Litany delve fixes #1593, baked wolf models #1572, admin reset-password #1595, character orientation strobe fix #1476. Conflicts: the generated i18n trio plus the delve_death parity golden (regenerated per the standing rules; UPDATE_PARITY re-mint changed only delve_death across all 98 goldens; i18n:gen idempotent) and ONE real code conflict, the bags tooltip hint block (both sides kept: extra + partial + destroy + link).
- release-merge-audit (9 auditors): the merge itself CLEAN both directions (diff-of-diffs byte-identical on all 8 auto-merged logic files; ws_auth/main.ts untouched; no new WS commands; the one new REST route has its surface-inventory row release-side; every bank premise intact). 1 blocking + 3 should-fix + 2 nits, ALL applied same-session; full record and adjudications in state.md "Release merge before Phase 8 QA".
- Next: run docs/bank-system/phase-08-qa.md in a fresh session.

### Phase 8 QA (2026-07-07)

- Verdict: PASS after fixes. 0 blocking + 2 should-fix + 3 nits + 6 INFO across six audit streams (correctness/abuse, test-coverage-auditor, dead-code CLEAN, privacy-security-review PASS, cross-platform-sync no-drift, qa-checklist READY 0/0) plus the run-only mobile legs; all applied same-session. Full record in state.md "Phase 8 QA outcomes".
- Preceded by the release/v0.23.0 merge e561a89b8 (see "Release merge 2026-07-07" above): one real code conflict (bags tooltip, both hints kept), the destroy-affordance reconciliation fixes, and the audit's sha256 re-baseline blocking fix.
- One real bug found via the mobile run-only handoff and fixed: the bonus footer overflowed the 360px-tall phone window and crushed the grid to a 4px sliver; restructured as the shared .bank-scroll region (grid + bonus tail, buy row pinned below), live-verified at both viewports in both layouts on fresh and entitled accounts.
- Live end-to-end entitlement proof against the real server + db: fresh account 0/24 with all four adverts; granted facts stamp exactly 6/30 on the next fresh join (level-9 referee excluded, cross-realm level-12 counted, referral progress 2/5 + explainer); deleting the qualifying referee character drops the next join to 4/28. Referral-qualification policy recorded: LIVE, present-tense (deletion disqualifies until re-leveled; shrink tolerated, nothing destroyed).
- Test hardening: referral-direction SQL predicates pinned; pending-join clear after a bonus rejection proven by a retry; populated bonusSources pinned through the ClientWorld decode; computeBankBonus NaN decay + malformed-future-row shapes pinned.
- Next: run docs/bank-system/phase-09-final-qa.md in a fresh session (the packet closer).

### Release merge 2026-07-07 (before Phase 9 final QA)

- Merged origin/release/v0.23.0 (94 commits, tip 6066e4420) as 2477524f4: the online-movement-feel epic #1534 (player_motion.ts kernel extraction), the full professions epic + wiki chain, heroic dungeon difficulty + the Heroic Marks vendor #1575, the 0.23.0 version bump with the release locale fill. Conflicts: five source files (COMMAND_NAMES, NpcDef, openVendor, and the two count-pin suites, all resolved as exact unions with pins re-derived: send/dispatch 124/133, IWorld members 189 = 51 data + 138 method) plus the generated i18n trio and 49 parity goldens (regenerated on the merged tree; sha256 re-baselined in the same commit). Full npm run gate PASS.
- release-merge-audit (13 auditors): the merge is clean both directions everywhere outside the hand-resolved files. One emergent finding fixed same-session: the Heroic Marks shop (a second #vendor-window tenant) bypassed the bank/vendor exclusivity guards in both directions; both arms now cross-close, pinned in tests/bank_window.test.ts. One nit fixed: stale 50/135 partition prose in world_api_parity. Full record in state.md "Release merge before Phase 9 final QA".
- Same-session documentation: the /wiki Economy page gained its bank section (four guide.economy.bank* keys, five non-Latin fills each); server/CLAUDE.md, src/sim/CLAUDE.md, and the README now cover the bank surfaces (ledger, entitlements, lease, the module row, the persistence list).
- Next: run docs/bank-system/phase-09-final-qa.md in a fresh session (the packet closer).

### Whole-feature gap review 2026-07-07 (before Phase 9 final QA)

- Three parallel reviewers over the post-merge feature. Completeness critic: NO new phases needed, PR-ready after phase-09-final-qa; the PR body must surface the maintainer-calls (mobile long-press destroy suppression, deposit-all tool-sweep incl. Heroic Marks, banker discoverability, balance numbers) and the follow-ups (bank_ledger pruning, audit cadence/alerting, ip_block_kick mock hygiene). Release-content interaction review: professions/heroic/crafting/movement-feel/instances all clean at product level.
- ONE CRITICAL found by cross-platform-sync and fixed same-session: the bank had no client entry point in normal play (openQuestDialog had no banker arm; every prior smoke opened via the __game.sim.interact() debug hook, masking it through eight QA phases). Fixed test-first as the openQuestDialog banker divert, live-proven through a real KeyF press. Full record and the standing real-input-path lesson in state.md "Whole-feature gap review before Phase 9".
- Next: run docs/bank-system/phase-09-final-qa.md in a fresh session (the packet closer; its UI cluster must drive the open legs through the REAL interact key, tmp/bank_real_interact_probe.mjs is the template).
