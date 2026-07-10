# Book of Deeds: the WoCC achievements system (design packet)

INTERNAL PACKET. This directory is working material for building the achievements
feature. The word "phase" and any reference to this packet must NEVER appear in
code, comments, commit messages, or PR text. Packet vocabulary lives only in these
files. Cleanup policy (revised 2026-07-09 by maintainer instruction): the durable
parts (this overview, catalog/, progress.md, screenshots/) are KEPT as the record
that helps future sessions; only the per-session working files are deleted at the
end of a round (the first round's went in commit 5f373ddca; the polish round's go
in the phase-16-qa exit step).

How to use this packet: execute the files in order, one session per file, following
the strict cadence: implement file, then its dedicated QA file, then the next
implement file. Never start file NN+1 before phase-NN-qa.md has been run. Every
completed session ends by naming the NEXT file (full path). Status lives in
`progress.md`; update it at the end of every session.

Each implement file is a self-contained spec written for autonomous execution
(Fable 5, xhigh, ultracode): it carries its own intent, constraints, invariants,
acceptance commands, and reviewer dispatch. If an implement file and this overview
ever disagree, this overview wins; flag the conflict in the session output.

## 1. Product decisions (locked with the maintainer, 2026-07-08; do not re-litigate)

1. Rewards are STRICTLY cosmetic: titles, badges, nameplate borders, flex. No
   player power, no convenience perks. (Mild convenience may come much later;
   not in this build.)
2. Per-character earn records (stamped with earner and date), with an
   account-wide roll-up as the display and leaderboard layer. Renown counts each
   deed once per account.
3. State-predicate deeds evaluate naturally against persisted state: veterans
   get credit for deeds their character verifiably already did (quest lines,
   levels, delve clears, arena rating). New lifetime counters start at zero for
   everyone. No suppression or grandfathering machinery.
4. Offline and online are completely separate. No sync in either direction,
   ever. Offline characters are ephemeral today, so offline deeds are naturally
   session-scoped; the same sim evaluator runs there as a sandbox.
5. Milestones unify INTO deeds: the five lifetime-XP milestones become deeds
   whose rewards are the existing titles and borders. One prestige system.
6. Leaderboards: lifetime boards only. No seasons in this build.
7. Steam: account LINKING is allowed; LOGIN WITH STEAM IS FORBIDDEN, hard rule.
   Login stays email + Discord only, everywhere, always. All Steam surfaces are
   env-gated and OFF by default (the Steamworks app is not created yet; nothing
   may block on it). Steam integration is built FROM SCRATCH in this packet: do
   not consult or resurrect the old prototype branch. The `steamworks.js`
   dependency is maintainer-sanctioned (2026-07-08) as an explicit exception to
   the tiny-dependency rule, scoped to the Electron main process of the desktop
   shell; it never enters web bundles.
8. i18n: English only during this work, via the sanctioned pending mechanism.
   No translation passes; translations happen once at the very end of the
   project (release-fill workflow). Never hand-write English into a locale
   overlay file.
9. Voice: fun, WoCC-flavored naming (see glossary). The maintainer named the
   first Chronicler NPC: Saul.

## 2. Glossary (player-facing names, all rendered through t())

| Term | Meaning |
|---|---|
| Deed | One achievement. The everyday word in chat and broadcasts. |
| Book of Deeds | The achievements window. |
| Renown | Achievement points. Quantized 5, 10, 25, 50. Zero for luck-based and dynamic-meta deeds. |
| Chronicle | A per-zone task set (the OSRS-diary-shaped layer), split into Chapters. |
| Chronicler | The in-world NPC face of a zone's Chronicle. The first is Saul (Eastbrook Vale). |
| Feat | A zero-Renown deed: legacy, world-first, or unobtainable-by-design. Excluded from completion percentages. |
| Title | A cosmetic name suffix a player can select and display (nameplate, inspect, character panel). |
| Border | A cosmetic nameplate/panel border flourish. |

## 3. Canonical identifiers (authoritative; every file uses exactly these)

Code namespace is `deeds`. "Achievement(s)" appears in code only inside the Steam
integration, where it is the platform's own term.

| Thing | Canonical name |
|---|---|
| Content table | `src/sim/content/deeds.ts` exporting `DEEDS: Record<string, DeedDef>` and `DEED_ORDER: string[]` (append-only, like `QUEST_ORDER`) |
| Def type | `DeedDef` in `src/sim/types.ts` (id, name, desc: English; category; renown; trigger; reward; hidden; feat) |
| Sim evaluator | `src/sim/deeds.ts`, a system module behind `SimContext` |
| Per-player state | `PlayerMeta.deedsEarned: Map<string, string>` (deed id to the utcDay string earned, 'YYYY-MM-DD', empty when the host sets no calendar), `PlayerMeta.deedStats` (persisted lifetime counters), `PlayerMeta.activeTitle: string \| null` (a deed id) |
| Persisted save keys | `CharacterState.deeds`, `CharacterState.deedStats`, `CharacterState.activeTitle`; `CharacterState.renown` (number, denormalized for the board index) |
| Sim event | `deedUnlocked { pid, deedId, retro? }` (id-based, never English text) |
| IWorld facet | `IWorldDeeds` in `src/world_api/deeds.ts` |
| Wire command | `deed_set_title` |
| Entity wire field | `title` (a deed id) for nameplate/inspect display |
| UI window | `src/ui/deeds_view.ts` (pure core, in `UI_PURE_CORES`) + `src/ui/deeds_window.ts` (cold painter window) |
| Name localization | `src/ui/deed_i18n.ts` (entity-style English table, like `talent_i18n.ts`; outside the catalog so M16 does not apply) |
| Chrome strings | `hudChrome.deeds.*` section in `src/ui/i18n.catalog/hud_chrome.ts` (sanctioned English-only domain) |
| Keybind action | `deeds` (default `KeyZ`; `KeyY` is taken by the Vale Cup window, verified during packet authoring) |
| DB table (records) | `character_deeds` (realm TEXT with NO default; account_id; character_id; deed_id; earned_at; UNIQUE(character_id, deed_id)) |
| DB table (Steam) | `steam_links` (account_id, steam_id, created_at; link is never an auth path) |
| Server Steam domain | `server/steam/` (RouteDef modules + `achievement_map.ts` mapping deed id to `ACH_<UPPER_SNAKE>`, max 100 entries) |
| Env flags | `STEAM_ENABLED` (default off), `STEAM_APP_ID`, `STEAM_WEB_API_KEY` |
| Desktop module | `electron/steam.cjs` + `wocDesktop.steamLinkTicket()` preload bridge method |
| Guide page | `src/guide/pages/deeds.ts` at route `deeds` |
| Deed id format | lower_snake with category prefix: `prog_`, `cmb_`, `dgn_`, `dlv_`, `chr_`, `col_`, `pvp_`, `soc_`, `exp_`, `feat_`, `hid_` |

## 4. Architecture blueprint

One sim, three hosts: the deed catalog and evaluator live in `src/sim/` and run
identically offline, on the server, and headless. The server layers persistence,
rarity, broadcasts, leaderboards, and Steam on top as OBSERVERS; it never decides
unlocks (the sim does). The RL env is untouched: the evaluator reads counters and
state, draws ZERO rng, and emits id-based events; nothing feeds the reward channel.

Flow, end to end:

1. Gameplay sites that already maintain counters and state (kill/death/loot/xp
   sites in `src/sim/combat/damage.ts`, quest turn-in, delve clears, arena and
   Vale Cup results) additionally bump `PlayerMeta.deedStats` and mark the player
   dirty via append-only `SimContext` callbacks, exactly the shape of
   `onMobKilledForQuests`.
2. The evaluator runs at the very end of the tick tail (after the
   delayed-event drain, before grid re-bucketing; the zero-rng tail placement
   the Vale Cup established) over dirty players only: checks triggers,
   grants into `deedsEarned` with the sim's `utcDay`, recomputes `renown`, emits
   `deedUnlocked`. On world join it evaluates all predicates against loaded
   state and emits grants with `retro: true` (the client batches those into one
   summary line, no banner spam).
3. Milestones: `MILESTONES` re-express as `prog_*` deeds rewarding the same
   titles/borders. `checkMilestones` folds into the evaluator. Loading maps
   `unlockedMilestones` into `deedsEarned`; `unlockedMilestones` stays
   dual-written for one release as rollback insurance (forward-only rollout,
   the bank precedent).
4. The server world loop's `detectActivity` observes `deedUnlocked` and upserts
   `character_deeds` fire-and-forget on the FIFO promise tail (bank-ledger
   pattern: observer, never authority). Guild and friend broadcast is delivered
   per recipient session as server-injected events frames, resolved through the
   social transport; the earner's own toast rides the existing `{t:'events'}`
   frame client-side.
5. Reads: rarity percentages and the account-Renown leaderboard are computed
   from `character_deeds` plus the in-memory `DEEDS` table, TTL-cached in
   `main.ts` like the existing boards, served by a public-read RouteDef module
   modeled on `server/leaderboard.ts`. All board queries (new AND existing)
   gain moderation-state exclusion, and the ban path delists.
6. Steam (dark until `STEAM_ENABLED=1`): a linked account's unlocks mirror to
   Steam via the publisher Web API from the server; a reconcile job on link
   pushes everything already earned. The desktop app's only role is producing a
   session ticket for the link handshake. Web players with a linked account
   earn Steam achievements too.

## 5. Rules that bind every session of this packet

- All repo invariants apply in full: sim purity and determinism (all randomness
  through Rng, and this feature draws none), IWorld as the only seam, server
  authority, module-first (no coordinator growth), append-only SimContext.
- COSMETIC-ONLY GUARANTEE: no deed, reward, or Steam surface may confer power,
  convenience, or actionable information. Watchlist and toasts are player-chosen
  cosmetic info and must stay fairness-safe under the graphics-tier rules.
- Every player-visible string is a t() key, English only, via the pending
  mechanism. Deed names/descs live in sim content (English) and re-localize
  client-side through `deed_i18n.ts`; events carry ids, never English, so the
  S3 guard stays green. The M16 exposures are wordy `guide.*` prose in the wiki
  session and any new wordy `apiError.*` leaves (the persistence and Steam
  sessions): do the forced minimum five non-Latin fills for exactly the keys
  the gate flags, nothing more.
- No em dashes, en dashes, or emojis anywhere, including these packet files.
- Never write "phase"/"phases" or packet references into shipped artifacts.
- Commits: Conventional Commits on this branch, scope `deeds` (or the touched
  domain: `net`, `ui`, `server`, `guide`, `electron`). Stage explicit paths only;
  never `git add -A` (shared-tree discipline applies to worktrees too).
- Biome on touched files only (`npx @biomejs/biome check --write <file>`); never
  whole-repo. `npm run gate` unpiped before calling a session done.
- Fix bugs test-first. New logic lands as small tested modules behind existing
  seams. Data tables (the catalog) are exempt from modularity pressure.
- Wiki freshness: any content change that feeds the guide re-runs
  `npm run wiki:content` and commits the regenerated artifact.
- Catalog hash discipline: a catalog key change needs the sha256 re-baseline in
  the SAME commit.

## 6. Research lessons this design carries (condensed; full digest in session notes)

1. Points-first thresholds, never all-or-nothing tier gating (OSRS Combat
   Achievements had to retrofit this).
2. Zero points for luck; zero points for dynamic metas whose requirements grow;
   the score never decreases on a content patch (RS3's two best rules).
3. Small closed trigger vocabulary (kill count, mechanical, perfection,
   restriction, speed, completion, collection, interaction) keeps authoring
   hundreds of deeds cheap and teaches encounters.
4. A deed should fail only through player error, never RNG.
5. Show the rules, hide the reveal: hidden deeds are a small delight/spoiler
   set; criteria of everything else are visible with progress bars
   (endowed-progress effect: visible partial progress is the cheapest
   abandonment reducer).
6. No permanently missable deeds. Retired content moves to Feats, preserved
   visibly (FFXIV Legacy pattern), never deleted.
7. Multiplayer deeds must be satisfiable only by being a better teammate;
   PvP deeds use rating thresholds, not win counts (win-trading).
8. Grind thresholds sit where natural play lands; count outcomes, not attempts
   (the FFXIV Astrope lesson).
9. The bulk of the catalog lives in the first two-thirds of the journey;
   sub-1% unlocks are deliberate prestige only (Steam completion-rate reality).
10. Titles are the flagship reward and scale for free; one visible display
    surface (nameplate) makes deeds social identity (CoH, FFXIV).
11. Regional task sets bound to geography with an in-world claim ceremony are
    the most praised structure in the genre (OSRS diaries), but rewards stay
    cosmetic where OSRS chose power and got a mandatory checklist tax.
12. Leaderboards: entry floors, score-then-earliest tie-break, percentile
    presentation for the mid-board, delisting wired into the ban pipeline from
    day one (OSRS's standing credibility wound), never a capacity cap that can
    drop legitimate play (the raider.io lesson).
13. Steam: pre-registered achievements, 100-cap until an unpublished threshold,
    server store canonical with Steam as a mirrored subset, reconcile on link
    (the Cogmind pattern), hidden flags for spoiler deeds, Progress Stats where
    they fit.

## 7. The catalog

The full v1 catalog lives in `docs/achievements/catalog/` as reviewable data:
one file per category plus a README with authoring rules, Renown budget, title
and border registry, and the Steam marquee list. The catalog is the source of
truth that the first implement session transcribes into
`src/sim/content/deeds.ts`. Target size: roughly 180 deeds; roughly 75 Steam
marquee entries, comfortably under the 100 cap.

## 8. Session map

| File | Scope (one line) | Primary reviewers at QA |
|---|---|---|
| phase-01-sim-core.md | DeedDef + DEEDS content (from the catalog), evaluator module, persisted deedStats and earned state, deedUnlocked event, milestone unification, retro-on-join, tests | architecture-reviewer, test-coverage-auditor |
| phase-02-iworld-wire.md | IWorldDeeds facet, deed_set_title command, entity title wire, ClientWorld mirror, parity/snapshot/command pins | cross-platform-sync, test-coverage-auditor |
| phase-03-deeds-window.md | Book of Deeds window (view core + painter), watchlist + HUD tracker, badge crests, earned banner + VFX + audio, retro batch UX, keybind, chrome i18n | qa-checklist, test-coverage-auditor |
| phase-04-server-persistence.md | character_deeds table + observer, guild broadcast, rarity cache + endpoint, public sheet extension | migration-safety, privacy-security-review |
| phase-05-leaderboard.md | Account-Renown lifetime board (global only; accounts span realms) + window, entry floor, tie-break, cheater delisting across ALL boards wired to the ban path | privacy-security-review, migration-safety |
| phase-06-wiki-guide.md | Guide page (spoiler-safe, hidden deeds excluded), generator extension, routes, sitemap, minimum M16 fills | qa-checklist |
| phase-07-steam.md | steam_links + link RouteDefs (env-gated, link-not-login), publisher Web API mirror + reconcile, electron steam.cjs + bridge, achievement_map, icon export script | privacy-security-review, migration-safety, cross-platform-sync |
| phase-08-mobile-polish.md | Mobile + a11y for the window and toasts, fairness and perf verification, catalog balance pass, PR prep (PR-tier gate; pending i18n rows expected). Packet deletion happens in the paired QA session's exit step, never here | qa-checklist, test-coverage-auditor |

Each implement file has a paired `phase-NN-qa.md`. After packet review, the first
session file is `docs/achievements/phase-01-sim-core.md`.

## 9. Polish round session map (added 2026-07-09; sessions 01 to 08 are DONE)

The feature shipped complete through the 08 QA gate. The maintainer then
ordered a polish round: catalog re-review against content that landed since
authoring, real icon art, cosmetic titles on more surfaces, unique spread-out
Chronicler NPCs with one renamed to Zenzie, the durable documentation layer,
screenshot evidence, and the full translation fill (this round RETIRES
decision 8's English-only rule in its final session, by maintainer
delegation). Same cadence, same rules; base is release/v0.24.0 (merged
db71dad6d).

| File | Scope (one line) | Primary reviewers at QA |
|---|---|---|
| phase-09-catalog-refresh.md | Catalog re-review vs today's content: salvage, crafting hub, Nythraxis crypt, temple back half, Marsh fishing debut; new deeds + counters + grant sites; deferral rechecks; maintainer icon brief for new ids | architecture-reviewer, test-coverage-auditor |
| phase-10-icon-art.md | Ingest the 512x512 icon set to 128px WebP under public/ui/deeds, static branch in the icon system, procedural fallback for artless ids, set-equality gate | qa-checklist, test-coverage-auditor |
| phase-11-title-surfaces.md | Titles in chat (id on the wire, pattern key), target frame, player card + OG page, guild roster, friends, XP board, profile page; desktop and mobile fit | cross-platform-sync, architecture-reviewer, test-coverage-auditor, qa-checklist |
| phase-12-chroniclers.md | Rename Thornpeak chronicler to Zenzie (id retained), shared mage look with distinct tints, spread placements, catalog doc sync | architecture-reviewer, qa-checklist |
| phase-13-docs-screenshots.md | README + CLAUDE.md touchpoints, docs/design/deeds.md, the content-flow rule (every new conquerable content ships its deeds), screenshot evidence matrix into the packet | qa-checklist |
| phase-14-catalog-recheck.md | Second catalog re-review vs everything merged during the polish round (enchanting, jail, heroic marks, playtime, auth plumbing); every in-range system gets a deed or a written rejection; deferral rechecks; zero additions is a legitimate outcome | architecture-reviewer, test-coverage-auditor |
| phase-15-wiki-audit.md | Whole-wiki deeds audit against the final catalog and feature set: set equality, spoiler safety re-proven from scratch, feature-currency prose, cross-page sweep with recorded judgments; last English before the freeze | qa-checklist |
| phase-16-translations.md | Full deeds-scope release fill: overlays + DEED_LOCALES across all 21 locales, glossary extension, Zenzie stale-fill fixes; non-deeds pending untouched | qa-checklist, per-family spot reviewers |

Sequencing rationale: the catalog freezes first so the icon brief reaches the
maintainer early and later sessions build on final content; icons and titles
are independent; docs and screenshots capture the finished visuals; the
recheck (14) re-freezes the catalog against everything the round's release
merges brought in, the wiki audit (15) then freezes the guide prose against
that final catalog, and translations run absolutely last, after English
freezes. The polish round's first session file is
`docs/achievements/phase-09-catalog-refresh.md`.
