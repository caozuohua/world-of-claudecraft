# The v1 Deed catalog: authoring rules

This directory is the reviewable source of truth for the launch catalog. The
first implement session transcribes it into `src/sim/content/deeds.ts`. Edit
here first, code second, until that session lands.

## Files

| File | Prefixes | Target | Steam quota |
|---|---|---|---|
| progression-combat.md | prog_, cmb_ | ~35 | 14 |
| dungeons-delves.md | dgn_, dlv_ (+ cmb_ for the world boss) | ~40 | 20 |
| chronicles.md | chr_ | 9 chapter metas | 3 |
| collection.md | col_ | ~25 | 8 |
| pvp-sport.md | pvp_ | ~25 | 12 |
| social-economy-exploration.md | soc_, exp_ | ~25 | 8 |
| feats-hidden.md | feat_, hid_ | ~20 | 6 |

Roughly 180 deeds total; Steam marquee total must stay comfortably under 100.
(The table above records the original authoring targets; the audited
post-review counts, which drifted from them slightly, live in the Assembly
resolutions section below.)

## Entry format (uniform, one block per deed)

```
### <deed_id>
- Name: <English name, WoCC voice>
- Desc: <one player-facing English sentence; states the criteria plainly>
- Renown: 0 | 5 | 10 | 25 | 50
- Trigger: <precise, implementable condition over REAL game state>
- Reward: none | title "<Title>" | border <slug>
- Hidden: no | yes (reveal note)
- Steam: no | ACH_<UPPER_SNAKE>
- Notes: <optional: balance notes, trigger site, retro behavior>
```

## Hard rules

1. Only reference content that actually exists in `src/sim/content/` on this
   branch. Read the files; never invent a mob, zone, item, boss, or system.
   Cite the source file in Notes when the reference is non-obvious.
2. Renown scale: 5 routine, 10 standard, 25 notable, 50 prestige. ZERO Renown
   for anything luck-dependent (rare drops), for dynamic metas whose
   requirements grow with content, and for all feats. The account score must
   never be able to decrease.
3. Rewards are cosmetic only: titles and borders in v1, nothing else. Most
   deeds reward none; titles go on marquee deeds (aim 15 to 20 titles total),
   borders on meta capstones (aim about 6). Reserved titles already taken by
   the milestone deeds: Veteran, Champion, Paragon, Mythic, Eternal.
4. Trigger vocabulary (use only these shapes): predicate over persisted state
   (level, questsDone, delveClears, arenaRating, craftSkills, and similar),
   lifetime counter threshold (new deedStats counters), completion (specific
   dungeon/delve/quest/encounter, normal or heroic), mechanical / perfection /
   restriction / speed (encounter skill tasks that fail ONLY through player
   error, never RNG), collection (own or have logged specific items), 
   interaction (NPC, POI, object), and meta (a list of other deed ids).
5. No permanently missable deeds. Anything tied to seasonal or retired content
   is a Feat (feat_, 0 Renown), excluded from completion percentages.
6. PvP uses rating thresholds and match milestones that cannot be win-traded
   profitably; social deeds count outcomes, not attempts, and must be
   satisfiable only by being a better teammate. No deed may reward griefing,
   AFK attendance, or pure login.
7. Grind thresholds sit where natural play lands. Most of the catalog must be
   reachable in the first two-thirds of a character's journey; sub-1% unlocks
   are deliberate prestige only.
8. Hidden deeds (hid_) are a small set of delights and spoiler-guards: fully
   invisible until earned. Everything else shows criteria and progress.
9. Voice: playful classic-MMO English. In-world proper nouns are fine; no
   real-world references except sanctioned easter eggs (Bursar Fernando
   precedent; Saul the Chronicler). No em dashes, en dashes, or emojis.
10. Steam column: marquee, legible, spoiler-safe deeds only (Steam names and
    descriptions are public); hidden deeds may be Steam-hidden. API names are
    stable forever: `ACH_` plus the upper-snake deed id without its prefix
    where unambiguous.

## Registries (kept in sync during assembly)

- Titles: each catalog file lists its proposed titles at the top; duplicates
  are resolved at assembly.
- Borders: proposed border slugs likewise.
- Steam: each file lists its ACH_ names at the top for the global under-100
  audit.

## Assembly resolutions (authoritative; read before transcription)

Audited totals after the adversarial-review fixes (2026-07-08, scripted
recount): 197 deed blocks across the seven files (chronicles 23, collection
24, dungeons-delves 42, feats-hidden 19, progression-combat 36, pvp-sport 28,
social-economy-exploration 25), no duplicate ids, names, titles, or ACH
names; 2,370 total Renown; 21 titles; 3 borders; 70 Steam entries authored.
After the deferrals below (11 blocks, 85 Renown, 2 Steam, 2 titles), the v1
launch set is 186 deeds, 2,285 Renown, 68 Steam entries, 19 titles, 3
borders.

1. DEFERRED means: the block STAYS in this catalog as reviewed design, but is
   NOT transcribed into `src/sim/content/deeds.ts` or `DEED_ORDER` in v1, and
   its ACH_ name is NOT registered on Steam yet. The first implement session
   lists every deferred id in its commit body (the no-silent-drop rule).
2. Deferred for account-level evaluation (the v1 evaluator is per-character;
   a follow-up server-grant lane can land these): prog_three_paths,
   prog_ninefold (holds ACH_NINEFOLD), and the seven server-assisted feats:
   feat_before_the_book, feat_realm_first_cap, feat_founders_circle,
   feat_realm_first_nythraxis, feat_realm_first_thunzharr,
   feat_realm_chronicler, feat_top_of_the_book.
3. Deferred as currently unearnable: prog_ringwright (holds ACH_RINGWRIGHT);
   jewelcrafting, inscription, and enchanting have zero recipes today.
   MAINTAINER FLAG: revisit when those crafts get recipes.
4. Cut from v1: pvp_vcup_bet_flex (marked optional by its author; we do not
   ship betting-adjacent deeds, even at 0 Renown).
5. Fiesta gating: online Fiesta practice and the offline sandbox both run the
   real match logic, so every pvp_fiesta_* trigger counts REAL matchmade bouts
   only (never practice bouts). The sim-core session verifies a
   practice-match flag exists to gate on; any Fiesta deed it cannot gate is
   deferred, not shipped farmable.
6. Chronicler NPC template ids are pinned: chronicler_saul,
   chronicler_osric_fenn, chronicler_edda_hartwell (definitions in
   chronicles.md).
7. feat_era_cap is resolved via a `DEEDS_ERA` string constant in
   src/sim/content/deeds.ts, bumped only by the maintainer at era boundaries.
8. Zone naming: zone 2 is Mirefen Marsh (mirefen_marsh); "Deepfen" is one of
   its POIs, not the zone. Early design notes that say "the Deepfen" mean
   Mirefen Marsh.
9. Cross-file requirement ids in chronicles.md are pinned to the real deed
   ids (dgn_hollow_crypt, dgn_sunken_bastion, dgn_gravewyrm_sanctum,
   dlv_reliquary, dlv_litany, cmb_thunzharr).
10. dgn_sanctum_speed ships with its 15-minute threshold marked
    CALIBRATE-AT-IMPLEMENT (no instance timestamp persists yet; the sim-core
    session picks the mechanism, the window session shows no timer UI).
11. Duplicate sweep (adversarial review): five duplicated accomplishments
    were merged. col_delve_journal was DELETED; the one global journal deed
    is dlv_lore_journal (dungeons-delves.md), which now holds
    ACH_DELVE_JOURNAL. hid_golden_goal was DELETED (its ACH_GOLDEN_GOAL slot
    with it); the golden-goal moment lives solely on pvp_vcup_golden_goal
    (pvp-sport.md, rated-gated). The three chr_*_landmarks tasks were
    DELETED; the per-zone visit-all-POIs deeds are exp_vale_wayfarer,
    exp_marsh_wayfarer, exp_peaks_wayfarer (social-economy-exploration.md,
    which owns the single POI-visit mechanism: the poisVisited set, within
    20 yd, 1 Hz sweep), and the Chronicle Chapter I metas require them.
12. Vale Cup gating standard (mirrors resolution 5's Fiesta rule): Cup
    participation deeds demand a PERSONAL OUTCOME, never attendance.
    chr_vale_cup_debut requires a personal ball touch in a QUEUED bout;
    pvp_vcup_first_match requires seeing the match out AND a personal touch,
    kick, or save. Bot-backfilled queued bouts count for these two debuts
    only; practice bouts and offline-staged bouts NEVER count for any Cup
    or Fiesta deed.
13. Discovery-ladder retune: the top rung is col_discovery_250 (threshold
    250, ACH_DISCOVERY_250, border curators_gilt). 250 is luck-independent
    by construction: 253 sub-rare items plus the 10 deterministic Heroic
    Quartermaster epics clear it with zero rare-quality drops, and World
    Market purchases count as acquisition.

## Assembly resolutions, polish round (2026-07-09)

Catalog re-review against the tree as of this round (salvage, the level-20
crafting hub, the professions intro quest, heroic equalization, and the
pre-baseline audit holes: the Nythraxis crypt, the Drowned Temple back half,
Sethrael, the Marsh fishing debut). This section APPENDS to the 2026-07-08
resolutions above and never rewrites them.

14. Audited totals after this round (scripted recount of deeds.ts): 8 new
    blocks authored (progression-combat 4, dungeons-delves 1, chronicles 1,
    social-economy-exploration 2); 6 transcribed, 2 deferred (resolution 17).
    The live set is 192 deeds (progression 30, combat 10, dungeon 27, delve
    13, chronicle 24, collection 24, pvp 27, social 16, exploration 9, feat
    3, hidden 9), 2,365 Renown, 19 titles, 3 borders, 72 Steam entries
    (ACH_CROWN_BELOW, ACH_MERE_AT_REST, ACH_TOOLS_OF_THE_TRADE,
    ACH_NYTHRAXIS_CRYPT are the four new). New-deed Renown: 80 transcribed
    (plus 15 authored-deferred), inside the round's 60 to 110 window.

15. The no-retro-edit rule, binding this round and the next: existing deed
    TRIGGERS are never retro-edited. Widening a trigger list changes
    mid-progress fractions and re-scopes an earned deed's meaning; additions
    land as NEW deeds only. (Earned records are append-only either way; this
    keeps displayed progress honest.) Applied here: chr_marsh_first_cast is
    NOT added to the Marsh chapter metas, and Sethrael coverage lands inside
    prog_mere_at_rest (q_palecoil) rather than editing chr_marsh_rares.

16. Deferral rechecks, all re-verified against this tree:
    - prog_ringwright STAYS deferred: recipes.ts still carries 15 recipes,
      zero for jewelcrafting, inscription, or enchanting (scripted recount;
      the upstream enchanting PR is not merged here).
    - The nine account-level ids (prog_three_paths, prog_ninefold, the seven
      server-assisted feat_*) STAY deferred: server/deeds_records.ts is
      still observer-only; no account-level grant lane exists.
    - Deferral costs no art: the 11 orphan files in the maintainer's icon
      set already cover the deferred and cut ids.

17. NEW deferral: soc_first_salvage and soc_salvage_50 are authored (see
    social-economy-exploration.md) but NOT transcribed: salvage has zero
    player-facing wiring on any host (no IWorld member, no UI caller, no
    wire message or server command; Sim.salvageItem is not-yet-wired by its
    own comment), so both deeds would be visible yet unearnable by anyone,
    the prog_ringwright class. Their salvagesPerformed counter ships with
    the transcription (the counter doctrine forbids a key no deed reads).
    ACH_FIRST_SALVAGE is held, not registered. MAINTAINER FLAG: transcribe
    when salvage lands its player-facing surface.

18. Considered and rejected this round, each with its reason:
    - Class set-bonus collections: drop-luck gated; rule 2's zero renown
      would make them pure noise.
    - Per-class deeds: the catalog is deliberately class-agnostic.
    - Warlock pet collection: class-specific, same rule.
    - Lore letters: no counter exists and low signal.
    - Daily-reward streaks: login-shaped, forbidden by rule 6.
    - Heroic equalization: a difficulty retune; the existing dgn_ deeds
      already cover every instance at both difficulties. No catalog action.
    - The professions-intro "first profession pick" arm: no pick or
      selection state exists on this branch (professions are use-based
      skills), so no clean predicate; the deed covers q_prof_intro
      completion only.
    - A standalone Sethrael kill deed: covered via q_palecoil inside
      prog_mere_at_rest (the shortlist's preferred route); a second deed for
      the same rare would double-award one outcome.
    - A dungeonClears trigger for the crypt: nythraxis_crypt has no final
      boss (empty spawn list; relic-raised guardians), so the key never
      records and the deed would be permanently unearnable; the certifying
      quest predicate ships instead.
    - A crafting-hub visit-only deed: a visit is an attempt surface, not an
      outcome; the shipped deed counts station-bound craft completions.

19. Trigger-kind note for reviewers: prog_crown_below and prog_mere_at_rest
    are the first shipped users of the 'quests' trigger kind (the evaluator
    arm existed unused; content previously reached all-of-quests only
    through the meta questIds arm). No evaluator change was needed.

20. Verification-pass completeness addendum (2026-07-09): two further
    profession systems landed in the review range with no player-reachable
    outcome today, recorded here so no in-range system lacks a written
    resolution:
    - Recipe acquisition (professions/crafting.ts acquireRecipe and the
      knownRecipes set, with the optional per-recipe acquisition field in
      professions/types.ts): inert in this tree. No shipped recipe carries
      an acquisition entry (every recipe is grandfathered known) and no
      host exposes a learn surface (no IWorld member, no UI caller, no
      wire message, no server command), so a learn-a-recipe deed would be
      visible yet unearnable by anyone, the prog_ringwright class. No deed
      ships; revisit when a recipe actually requires acquisition.
    - Archetype refinement helpers (professions/archetype.ts pairedMajor
      plus the hobby and ceiling lookups): no new player-reachable outcome
      (the accept and switch surfaces are still empty client stubs, and
      archetype selection itself predates the v1 baseline), and the
      catalog stays class and archetype agnostic besides (resolution 18).
      No deed ships.
21. Post-round deferral recheck (2026-07-10, after the upstream enchanting
    profession PR #1712 merged into this branch): resolution 16's
    parenthetical "the upstream enchanting PR is not merged here" no longer
    holds, and "zero recipes" no longer describes enchanting: an ENCHANTS
    table now lives in src/sim/content/enchants.ts, and disenchant plus
    apply-enchant gain flat enchanting skill in the sim. Every deferral
    STANDS on the surviving ground: neither disenchant nor apply-enchant has
    player-facing wiring on any host (no IWorld member, no UI caller, no
    wire or server command; the module documents its own not-yet-wired
    status, the salvageItem class), jewelcrafting and inscription still have
    zero recipes, and salvage wiring is unchanged (resolution 17 holds).
    prog_ringwright, soc_first_salvage, and soc_salvage_50 stay
    untranscribed, and no enchanting deed ships (the resolution 20
    inert-system class; revisit when the player-facing surface lands).
    collection.md's "fully-enchanted equipment" rejection is superseded in
    its premise (per-item enchantment state now exists on ItemInstancePayload
    and PlayerMeta.equipmentInstance) but stands in its conclusion for the
    same no-wiring reason; any future coverage lands as NEW deeds per
    resolution 15. Two evaluator-side effects of the merge were fixed in
    code the same day, test-first: the enchanting skill-gain sites now mark
    the player deeds-dirty (the crafting.ts craftItem contract), and
    retroFallbackGrants no longer reads craftSkills.enchanting as proof of a
    first craft (it would have permanently misgranted prog_first_craft to a
    disenchant-only character on join).

## Assembly resolutions, second catalog recheck (2026-07-10)

Second re-review, covering everything that entered the branch after the
2026-07-09 refresh baseline (db71dad6d), so the catalog freezes against the
final tree before the wiki audit and the translation fill. This section
APPENDS to the resolutions above and never rewrites them. Tree audited:
feature/achievements at 5f7da7ae6.

22. Audited range and totals: five release merges landed on this branch
    since db71dad6d (ab0d9745c, c6c3fa634, 318b11b0f, 77cde32b4, ab04c265b),
    together bringing the release-side span 5c4628dc2 (what db71dad6d had
    merged) to 69150d670: PRs #1695 (mail parcel
    quantity), #1705 (heroic loot flair, soulbound, shared-personal marks),
    #1707 (world-boss quiet mechanics), #1710 (paladin heal-cost retune),
    #1711 (buff no-stack), #1712 (enchanting profession), #1718 (low-tier
    FCT fix), #1724 (mobile autorun), #1735 (in-game jail), #1738 (codex
    agent tooling), #1739 (/playtime readout), #1746 (wire-aura allocation),
    #1748 (native Discord auth), #1749 (Onrush min-range indicator), #1753
    (native Apple sign-in), plus the direct commits 667227aa0 (password
    reset + SES mail) and a0fb22fb4 (stale movement intent). The recheck
    session's own pre-work merge was a no-op: the release tip at session
    start, 69150d670, was already an ancestor of HEAD. One release merge
    landed upstream mid-session, AFTER the audited tip: cf57f4b0a (PR #1689,
    mobile HUD). It is NOT in the audited tree (the post-tip release tail
    carries zero src/sim or server files as of this writing) and falls to
    the next session's pre-work merge and recheck. Verdict:
    ZERO deeds added, removed, or edited. The live set stays 192 deeds
    (progression 30, combat 10, dungeon 27, delve 13, chronicle 24,
    collection 24, pvp 27, social 16, exploration 9, feat 3, hidden 9),
    2,365 Renown, 19 titles, 3 borders, 72 Steam entries (scripted recount,
    matching resolution 14 exactly). The six deeds resolution 14 transcribed
    were re-verified against the post-merge tree: every pinned quest id,
    counter, and fish mark still has a live producer, and every pre-existing
    DEED_ORDER position is byte-identical.

23. Considered and rejected this recheck, each with its reason:
    - The in-game jail (#1735): rule 6. The only way in is a moderator
      punishment (every jail command sits behind the moderation.act
      permission), so any jail deed is accessible only by being punished and
      would reward getting jailed. Serving the sentence is attendance; the
      jail brawl has no match object, no scoring, and no win state (kills
      credit nothing, deaths revive at full HP with no res sickness); and
      prisoners are locked out of every matchmade and instanced surface
      while serving (arena, Vale Cup, dungeons, delves, duels).
    - The /playtime lifetime readout (#1739): rule 6. totalPlayedSeconds
      accrues as raw connected time with no input gate (an AFK character
      parked in the world earns it at full rate; the existing
      lastActiveTick anti-AFK signal is never consulted), and presence is
      not an outcome.
    - Heroic-only epics and heroic variants (#1705): drop-luck gated, rule 2
      forbids. Soulbound is a delivery and trading restriction that writes
      no counter. The shared-personal Heroic Mark slot is a delivery-shape
      change for an outcome the catalog already awards (dgn_ heroic clears
      plus dgn_mark_circuit over heroicDaily.marked, both verified intact);
      a marks deed would either double-award one outcome or count a currency
      threshold, an attempt surface.
    - Account plumbing (native Discord auth #1748, native Apple sign-in
      #1753, password reset + SES 667227aa0): zero sim or world_api
      footprint (diff-tree verified per commit), no persisted gameplay
      state; the only conceivable framing is a login or account-link deed,
      barred by rule 6 and by the standing decision that even Steam linking
      is not deed-worthy.
    - QoL, balance, and tooling (#1746 wire-aura allocation, #1724 mobile
      autorun, #1749 Onrush min-range indicator, #1718 low-tier FCT fix,
      #1711 buff no-stack, #1707 world-boss quiet mechanics, #1710 paladin
      heal-cost retune, a0fb22fb4 stale movement intent, #1695 mail parcel
      quantity, #1738 codex tooling): the
      heroic-equalization precedent; retunes and fixes of existing content
      with no new countable outcome. Spot-verified where it mattered: the
      four deed accounting hooks in combat/damage.ts are untouched by
      #1711 and #1707, and the one mail deed (soc_by_ravens_wing) counts
      sends, not attachment quantities, so parcel stacking cannot change
      its semantics.
    - The three arcane enchanting materials (arcane_dust, arcane_essence,
      arcane_shard in items.ts, from #1712): their only acquisition path is
      disenchanting, which has no player-facing wiring (resolution 21), so
      they are unearnable today and leave the col_discovery_250 attainable
      pool untouched (threshold 250, pool unchanged at the 263 baseline).
    - The recheck worklist's queued-cast ability and warlock pet resummon:
      NOT IN RANGE. Neither exists anywhere in db71dad6d..HEAD (commit
      subject sweeps over both the branch and the release side came back
      empty); recorded so the next recheck does not chase them.

24. Jail-brawl combat-ledger interaction, ACCEPTED with reasoning (surfaced
    by the adversarial coverage pass, not the per-system review): jailed
    prisoners are mutually hostile, brawl damage flows through the single
    onDamageDealtForDeeds hook, so it advances the frozen lifetime counters
    behind cmb_heavy_hitter (damageDealt 500,000) and cmb_critical_eye
    (crits 500) against a revive-at-full-HP cellmate. Accepted because the
    combat ledger counts consensual PvP damage from duels, arena, and
    Fiesta by design (lifetime aggregates over all real combat), duels are
    freely repeatable with no punishment gate (so jail farming is strictly
    dominated by a path that needs no misbehavior), the venue cannot be
    entered voluntarily (moderation.act), and the training-dummy exclusion
    covers a different class: a freely available, non-retaliating practice
    target. The deaths stat feeds only cmb_first_fall (count 1), and the
    jail revive never applies res sickness, so hid_keepers_toll_twice
    cannot be jail-farmed. MAINTAINER FLAG: if the combat ledger ever
    excludes zero-stakes PvP sources, jailed-vs-jailed damage joins that
    exclusion in the same change.

25. Deferral rechecks, all re-verified against this tree:
    - prog_ringwright STAYS deferred: recipes.ts still carries 15 recipes
      (engineering 6, alchemy 2, armorcrafting 2, weaponcrafting 2,
      cooking 1, leatherworking 1, tailoring 1), jewelcrafting and
      inscription zero. The ENCHANTS table is reagent data consumed by
      applyEnchant, not recipeList entries, so it is not a recipe source
      for the craftSkills trigger.
    - soc_first_salvage and soc_salvage_50 STAY untranscribed (resolution
      17): Sim.salvageItem still has zero callers across world_api, ui,
      game, net, and server, and salvagesPerformed stays
      authored-in-catalog, absent-in-code, the compliant state (the
      counter ships with the transcription).
    - The nine account-level ids STAY deferred: server/deeds_records.ts is
      still observer-only (its sole write mirrors sim-decided unlocks into
      character_deeds; no grant lane exists).
    - Enchanting deeds STAY deferred (resolution 21 re-verified at this
      HEAD): no IWorld member, no UI or game caller, no wire or server
      command for disenchant or apply-enchant, and both evaluator fixes
      hold (the skill-gain sites mark deeds-dirty; retroFallbackGrants
      excludes enchanting). Forward note for the wiring day: the
      count-form craftSkill triggers (prog_craft_specialist,
      prog_around_the_ring) become satisfiable via enchanting skill too;
      that only eases them (a requirement can never grow), so no action is
      needed now or then.
    - Steam map headroom: 72 of 100 entries, unchanged.

## Assembly resolutions, recheck QA (2026-07-10)

The paired QA session for the second recheck. Its pre-work merge brought in
the one release merge resolution 22 recorded as post-tip, so the range audit
extends over it here, and the session's independent re-verification produced
one correction to the standing record. This section APPENDS to the
resolutions above and never rewrites them. Tree audited: feature/achievements
at b08b1bebd plus the two fix commits it produced (b88576f95, 832ba54de).

26. PR #1689 (mobile HUD fixes, release tip cf57f4b0a, merged here as
    b08b1bebd) is judged and closed: ZERO deeds added, removed, or edited.
    The second-parent enumeration (b08b1bebd^2 minus 69150d670, the
    resolution 22 lesson) shows exactly cf57f4b0a and its fifteen PR-branch
    ancestors; no other upstream change rode in. The delta carries zero
    src/sim, server, or world_api files (diff-tree verified); the
    substantive changes are pinch-zoom deadzone and sensitivity, app
    viewport sizing, map plus quest-log window stacking, generic mobile
    window safe-area padding, character-select compaction, and the
    rotate-to-landscape gate now covering web mobile in-game portrait (an
    access-mode removal aligned with the standing landscape-only policy; no
    countable outcome). The resolution 23 QoL rejection class applies. The
    two changed catalog keys are shell chrome (a mobilePreflight.rotateSub
    reword; its non-English staleness is upstream release-fill territory,
    not deeds scope). Live set re-verified by scripted recount at this
    tree: 192 deeds with the resolution 14 category split, 2,365 Renown, 19
    titles, 3 borders, 72 Steam entries; every pre-existing DEED_ORDER
    position byte-identical. Two merge interactions with the feature's own
    mobile surfaces were fixed test-first the same day (code, not catalog,
    recorded for the ledger): the managed-window close path stamped an
    inline display none on the always-rendered More tray, killing the only
    mobile entry point to the Book of Deeds (b88576f95), and the new
    generic bottom safe-area padding double-counted inside the inset-pinned
    deeds window (832ba54de).

27. col_discovery_250 baseline correction (surfaced by this QA session's
    adversarial recount; the shortfall predates the audited range):
    resolution 13's construction (253 sub-rare items plus the 10
    deterministic Heroic Quartermaster epics = 263, clearing the 250
    threshold with headroom) overcounts attainability. At this tree, twelve
    of the counted sub-rare defs have no gameplay acquisition path: the two
    arcane materials (pending disenchant wiring, resolution 21);
    bramblehide_jerkin, retired with the old Brightwood and kept
    deliberately as a feat_brightwood_relic target under hard rule 5; eight
    items whose Brightwood wildlife sources were removed in 626bd9a40 on
    2026-06-23, before the catalog was authored (soft_down, amber_hide,
    stag_antler, brightwood_venison, bristlehide_spaulders, sableweb_cord,
    crossroads_saber, wanderers_chestguard); and the never-referenced
    ancient_crypt_door def. The eight mech chroma plates are out-of-game
    swag grants besides. The strictly luck-free floor is therefore roughly
    236 attainable sub-rare plus 10 quartermaster epics plus the four
    deterministic delve-shop rares, landing at about the 250 threshold with
    little or no headroom rather than the documented 13. The deed stays
    comfortably earnable in practice (rare, epic, and heroic-variant
    discoveries all feed the meter, a heroic variant marks BOTH itself and
    its base id, and World Market purchases count as acquisition); the
    correction is to the rule 2 justification prose, not to earnability,
    and nothing in the audited range removed a source, so resolution 23's
    no-shrink conclusion stands. No catalog action (the threshold is frozen
    by resolution 15). MAINTAINER FLAG: the luck-free construction now has
    zero-to-thin headroom, so any future retirement of a deterministic
    source silently drops it below the threshold; recompute exactly at the
    next content removal and consider restoring deliberate headroom with
    future additions.

28. Minor register from the same verification pass, each point verified in
    code, none changing a standing verdict:
    - hid_keepers_toll_twice nuance on resolution 24: a prisoner jailed
      while ALREADY carrying The Keeper's Toll can have the qualifying
      death happen inside the jail (the aura survives the teleport and the
      death). One-time idempotent grant, and the jail itself can never
      generate the sickness (its revive never applies it), so no loop
      exists and the acceptance stands as written.
    - Dev hosts only: dev_teleport (ALLOW_DEV_COMMANDS=1, never production)
      can place a body inside the cage geometry; the intruder never gains
      the jailed flag, so no brawl hostility and no deed surface follows.
    - The mailAttachmentsSent counter is named per-attachment but bumps
      exactly once per send, which is what keeps soc_by_ravens_wing safe
      under resolution 23; any future change to count attachments would
      silently retune the deed. Name-level hazard only.
    - The jail lockout cited by resolution 23 lives entirely server-side
      (JAILED_BLOCKED_COMMANDS in server/game.ts covering arena, Vale Cup,
      dungeon, crypt, delve, and duel commands); no sim file carries a jail
      gate. Location note only; the lockout itself re-verified complete.

## Assembly resolutions, closing QA (2026-07-10)

The final QA session of the polish round. Its pre-work merge (done ahead of
the session, recorded in the working log) brought the one release merge that
landed after the b08b1bebd tree; the register below closes it, freezing the
catalog against the branch's final tree. Tree audited: feature/achievements
at 7d7d52c9b.

29. The v0.24.0 ready-check merge (ee0d8ab5c, release tip 4cbd550e4) is
    judged and closed: ZERO deeds added, removed, or edited. The
    second-parent enumeration shows exactly five upstream commits: PR #1716
    (raid and party ready check, /ready), PR #1758 (default-skin preview
    render fix: merge 282dd40b9 plus 38f961535 and its test 07f312491), and
    the package-lock picomatch sync 0717ebe44. Judgments, each verified in
    code: the ready check ships no deed under rule 6 (answering a prompt is
    attendance, not an outcome; a respond-N-times deed would reward button
    clicking and be farmable in a party of alts) and it writes no persisted
    state (ReadyCheck in src/sim/types.ts is Sim-internal session state
    keyed by party id, a responses map with a sim-clock deadline; no
    PlayerMeta, CharacterState, or deedStats surface exists to trigger on);
    the skin-preview fix is render-only and the lockfile sync is tooling
    (the resolution 23 QoL class). The deed accounting hooks in
    combat/damage.ts and the whole of src/sim/content/deeds.ts are
    byte-untouched by the delta (diff-tree verified). Live set re-verified
    by scripted recount at this tree: 192 deeds with the resolution 14
    category split, 2,365 Renown, scale-only renown values, 19 titles, 3
    borders, 72 Steam entries; every DEED_ORDER position unchanged. The
    merge's only i18n footprint is the 60 release-owned
    hudChrome.readyCheck pending rows (4 keys x 15 locales, the five
    non-Latin locales arrived filled per M16), upstream release-fill
    territory outside the deeds scope.
