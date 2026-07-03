# 02 — Shared working memory (live integration log)

> Fresh log, seeded at START (nothing renamed yet). Forward-looking only; NOT the source of
> truth. **The authoritative current contract is the code + the gates:** the LOCKED `NAME-MAP.md`
> (every old -> new string), `tests/ip_scrub.test.ts` (the verbatim-name scanner + its worklist),
> `tests/parity` (behavior unchanged), `tests/i18n_resolved_equivalence.test.ts` (the SHA gate).
> Read those for exact names/ids. This file is the running summary + the append-only registries.
>
> Read order each session: `README.md` (goal, surface map, scope) + `00-SHARED-CONVENTIONS.md`
> (rules, regen sequence, prime directive) + the LOCKED `NAME-MAP.md` FIRST. Do not re-derive
> what those hold.

## Status board (execution order: gate -> map -> tracks -> finale)
| ID | Title | Track | Mode | Status | Branch @ commit |
|----|-------|-------|------|--------|-----------------|
| G0 | De-IP gate + verbatim-name scanner | Spine | plain | done-on-track (2026-07-02; scanner RED by design: 142 baseline violations; all behavior gates green) | feature/ip-pivot @ G0 commit |
| G1 | Generate + lock the NAME-MAP | Spine | ULTRACODE | done-on-track (2026-07-02; 588 map rows, 603 names adversarially screened, 2 skeptic refutations fixed; scanner arms the full map: 812 RED baseline; old-column 100% hit-verified; AWAITING OPERATOR LOCK) | feature/ip-pivot @ G1 commit |
| V1 | Ability / spell rename | Vocab | plain | not-started | — |
| V2 | Talent + spec/tree rename | Vocab | plain | not-started | — |
| C1 | Creatures + coined family-id sweep | Creatures | ULTRACODE | not-started | — |
| C2 | Warlock demon-pet re-theme + pet-id sweep | Creatures | ULTRACODE | not-started | — |
| W1 | Item / set / augment rename | World | plain | done-on-track (2026-07-02; all 73 W1-owned scanner hits cleared, ip_scrub 920 -> 847; 4 goldens re-minted per operator ruling, golden_token_inspector PASS: 6 events-digest deltas, 0 violations; parity + i18n SHA + guide + S3 + tsc green) | track/ip-world @ W1 commit |
| W2 | Mob mechanic / aura name rename | World | plain | done-on-track (2026-07-02; all 8 locked W2 aura rows applied + 2 nythraxis literals sharing the 'War Stomp' string; S3 matcher (AURA_NAME_KEY + en/en_CA values) co-updated; ip_scrub 847 -> 839; 3 goldens re-minted, inspector --allow-state-hashes PASS: 6 events-digest + 15 state-hash deltas, 0 violations, state hashes sanctioned by a green RENAME_PROOF=1 tests/parity/rename_state_proof.test.ts (reverse-map re-digest reproduces every pre-slice state hash + events digest); parity + S3 + i18n SHA + guide + architecture + tsc green) | track/ip-world @ W2 commit |
| T1 | De-brand comments / docs / realm copy | Text | plain | not-started | — |
| Z1 | Integrate + regen + scanner-zero + release-fill handoff | Finale | plain | not-started | — |

Status values: `not-started` -> `in-progress (<who>)` -> `done-on-track (<branch> @ <sha>)` ->
`merged (<integration-sha>)`.

## NAME-MAP lock state (owned by G1) — the #1 cross-slice contract
- [x] G1 has filled every Coverage-checklist row in `NAME-MAP.md` (2026-07-02).
- [x] Operator has reviewed and flipped `NAME-MAP.md` STATUS to **LOCKED** (2026-07-02).
  Decisions at lock: all former generic-keep? rows decided (5 keeps: Sap, Smite, Claw, Dash,
  Rip; Wolf Form and Blessed Tallow keep their text); Mogger cluster KEPT as parody with the
  operator-authorized removal of 'Mogger' from the scanner HARDCODED_VERBATIM (same commit);
  Tunnel Rat Digger renamed (Deeprock Digger); Brandt greeting reworded; tier sets renamed
  (Barrowlord/Nightfang/Mournweave/Bonewrought/Direfang/Wraithfire/Galecall); realm word =
  "World"; ~35 SEO-mined names adopted (Semrush-verified + adversarially screened) incl.
  pairing cascades - see the map's lock header for the list.
- [x] Post-lock operator amendment (2026-07-02, final): ~22 new-name refinements from the
  operator's workbook margin notes (Quaking Slam, Bewitch, Icebind, Mending Waters, Menace,
  Lunar Tempest, specs Fieldcraft/Thundercall/Warspirit, unified X's-Guise aspects, ...);
  three operator suggestions declined for IP (Guardian, Ironeye, Thunderlord). Old/armed
  columns untouched - scanner baseline stays 920. Map final and frozen from here.
- Until both are checked, NO V/C/W/T slice may start. Append-only after LOCK; a slice needing a
  missing string STOPS and appends a request row here for the operator, never invents a name.

## OPERATOR RULING - parity goldens under rename (2026-07-02, Phase 4)
V1 and W1 independently proved the goldens' per-checkpoint `events` digests fold event TEXT
(display names embedded), so ANY display rename shifts them while every state hash, RNG
draw-order fingerprint, draw count and nextId stays byte-identical. Operator extended the
C1/C2 golden exception to ALL rename slices: re-mint with UPDATE_PARITY=1, then
`node ip-refactor/golden_token_inspector.mjs <worktree>` MUST pass before commit; the four
hardcoded old names in tests/parity/coverage.test.ts update to their new names (authorized
gate-text edit). Integrator re-mints on the merged tree in Phase 5; Z1 inspector-verifies the
final goldens. Map amendment #2 in the same ruling: Quaking Blow / Armor Shear / Oath of Iron
/ Seething Fury (+ pairings) and polymorph critter sheep -> toad.

## Scanner worklist registry (owned by G0) — the verbatim names still present
> G0 seeds this from the RED baseline (the names `tests/ip_scrub.test.ts` currently flags). Each
> track ticks the entries it clears. Z1 requires the whole list ticked (scanner fully green).

Seeded by G0 on 2026-07-02 from the RED baseline: **142 violations** across the armed
denylist (`npx vitest run tests/ip_scrub.test.ts`). Counts are baseline occurrence counts over
BOTH English layers (sim content `.name` fields + the resolved-en table's name/title fields).
Rows are per (denylist entry x owning slice), disambiguated by the FIELD each hit lands in:
ability-name fields are V1's, talent/spec-tree fields are V2's, mob mechanic/aura `.name`
fields (`mobs.<id>.mortalStrike/petSpell/stomp/purgeOnHit.name`) are W2's - so a shared name
(Mortal Strike, Fireball, Judgement, ...) appears once per owner and each track ticks only its
own row. A track's row is cleared when the scanner reports zero hits for that entry in that
track's fields.

**v0.19.0 additions screening (G0, 2026-07-02):** `git diff release/v0.18.0..release/v0.19.0
-- src/sim/content/ src/ui/i18n.catalog/` is EMPTY (that release changed CI tooling only), so
there are ZERO "v0.19.0 additions - need NAME-MAP rows". Nothing extra for G1.

The NAME-MAP is still PROPOSED/DRAFT, so this seed = the hardcoded verbatim-WoW list + the
map's sample rows. G1's LOCK finalizes the `old`-column source; any row it adds/flips arms or
disarms in the scanner automatically (the scanner re-parses the map at each run), so THE
BASELINE COUNT WILL GROW at G1 lock (verbatim ability names like Battle Shout, Hamstring,
Overpower, Frost Nova, Arcane Intellect, Holy Light, Arcane Shot, Frost Shock, Faerie Fire,
... are in the tree today but unarmed until their map rows exist).

| denylist entry | owning slice | baseline hits | cleared? |
|---|---|---|---|
| Heroic Strike (ability-name fields) | V1 | 2 | [ ] |
| Mortal Strike (ability-name fields) | V1 | 2 | [ ] |
| Sinister Strike (ability-name fields) | V1 | 2 | [ ] |
| Sunder Armor (ability-name fields) | V1 | 2 | [ ] |
| Thunder Clap (ability-name fields) | V1 | 2 | [ ] |
| Bloodthirst (ability-name fields) | V1 | 2 | [ ] |
| Shield Slam (ability-name fields) | V1 | 2 | [ ] |
| Fireball (ability-name fields) | V1 | 2 | [ ] |
| Frostbolt (ability-name fields) | V1 | 2 | [ ] |
| Pyroblast | V1 | 2 | [ ] |
| Arcane Missiles (ability-name fields) | V1 | 2 | [ ] |
| Polymorph (ability-name fields) | V1 | 2 | [ ] |
| Ice Barrier (ability-name fields) | V1 | 2 | [ ] |
| Eviscerate (ability-name fields) | V1 | 2 | [ ] |
| Slice and Dice | V1 | 2 | [ ] |
| Judgement (ability-name fields) | V1 | 2 | [ ] |
| Hammer of Justice | V1 | 2 | [ ] |
| Lay on Hands (ability-name fields) | V1 | 2 | [ ] |
| Consecration | V1 | 2 | [ ] |
| Mind Blast (ability-name fields) | V1 | 2 | [ ] |
| Arcane (tree, whole-value) | V2 | 1 | [ ] |
| Fire (tree, whole-value) | V2 | 1 | [ ] |
| Frost (tree, whole-value) | V2 | 1 | [ ] |
| Holy (tree, whole-value) | V2 | 2 | [ ] |
| Blessing of Sanctuary | V2 | 1 | [ ] |
| Ardent Defender | V2 | 1 | [ ] |
| Improved Fireball | V2 | 1 | [ ] |
| Heroic Strike (talent-name fields) | V2 | 1 | [ ] |
| Mortal Strike (talent-name fields) | V2 | 1 | [ ] |
| Sinister Strike (talent-name fields) | V2 | 1 | [ ] |
| Sunder Armor (talent-name fields) | V2 | 1 | [ ] |
| Thunder Clap (talent-name fields) | V2 | 2 | [ ] |
| Bloodthirst (talent-name fields) | V2 | 1 | [ ] |
| Shield Slam (talent-name fields) | V2 | 1 | [ ] |
| Fireball (talent-name fields) | V2 | 1 | [ ] |
| Frostbolt (talent-name fields) | V2 | 1 | [ ] |
| Arcane Missiles (talent-name fields) | V2 | 1 | [ ] |
| Polymorph (talent-name fields) | V2 | 1 | [ ] |
| Ice Barrier (talent-name fields) | V2 | 1 | [ ] |
| Eviscerate (talent-name fields) | V2 | 1 | [ ] |
| Judgement (talent-name fields) | V2 | 2 | [ ] |
| Lay on Hands (talent-name fields) | V2 | 1 | [ ] |
| Murloc | C1 | 2 | [ ] |
| murloc (prose, word-boundary) | C1 | 6 | [ ] |
| Slimy Murloc Scale | C1 | 2 | [ ] |
| candle-headed (prose) | C1 | 2 | [ ] |
| Tallow Candle | C1 | 2 | [ ] |
| Tallow Candle (prose) | C1 | 0 (belt-and-braces) | [ ] |
| Bristleback | C1 | 4 | [ ] |
| Bristleback Maul | C1 | 2 | [ ] |
| Bristleback Hides | C1 | 2 | [ ] |
| bristleback (prose, word-boundary) | C1 | 0 (belt-and-braces) | [ ] |
| Drakonid | C1 | 2 | [ ] |
| Sanctum Drakonid | C1 | 2 | [ ] |
| Mogger | C1 | 13 | n/a - operator KEEP (parody); scanner entry removed at lock |
| Imp | C2 | 4 | [ ] |
| Voidwalker | C2 | 4 | [ ] |
| Succubus | C2 | 4 | [ ] |
| Felhunter | C2 | 4 | [ ] |
| Felguard | C2 | 4 | [ ] |
| Infernal | C2 | 4 | [ ] |
| Doomguard | C2 | 4 | [ ] |
| Shadowmeld | W1 | 2 | [x] W1 2026-07-02 |
| Shadowmeld Tunic | W1 | 2 | [x] W1 2026-07-02 |
| Lightwell | W1 | 2 | [x] W1 2026-07-02 |
| Mortal Strike (mob `mortalStrike.name` aura field) | W2 | 1 | [x] W2 2026-07-02 |
| War Stomp (mob `stomp.name` aura field) | W2 | 1 | [x] W2 2026-07-02 (incl. the 2 shared-string literals in `src/sim/encounters/nythraxis.ts` transition auras - same locked pair, S3 matcher forced co-rename) |
| Devour Magic (mob `purgeOnHit.name` aura field) | W2 | 1 | [x] W2 2026-07-02 |
| Mind Blast (mob `petSpell.name` aura field) | W2 | 1 | [x] W2 2026-07-02 |
| Cleave (mob `cleave.name` aura field, armed at G1 lock) | W2 | 2 | [x] W2 2026-07-02 for `knight_commander_olen` ('Reaping Arc'); **1 RESIDUAL: `deathstalker_voss.cleave.name` = 'Deathstalker Cleave' has NO NAME-MAP row - REQUEST ROW for operator (W2 did not coin a name); the 'Cleave' scanner entry still hits that one aura field** |
| Frostbite (mob `frostbite.name` aura field, armed at G1 lock) | W2 | 1 | [x] W2 2026-07-02 |
| Battle Fury (mob `rampage.name` aura field, armed at G1 lock) | W2 | 1 | [x] W2 2026-07-02 |
| Banshee's Wail (mob `terrify.name` aura field, armed at G1 lock) | W2 | 1 | [x] W2 2026-07-02 |

## Generated-artifact touch log (the ONLY parallel conflict surface)
> Every rename slice regenerates these. The integrator resolves conflicts by RE-RUNNING the
> generators (`i18n:gen` + `i18n:hash --write` + `wiki:content`), never a hand-merge. Log which
> slice last regenerated so the integrator knows to re-run.

| artifact | last regenerated by |
|---|---|
| `src/ui/i18n.resolved.generated/*` | W1 (2026-07-02, track/ip-world); W2 re-ran i18n:gen 2026-07-02, output byte-identical (mob mechanic names do not feed the resolved table) |
| `src/ui/i18n.resolved.sha256` | W1 (2026-07-02, track/ip-world); W2 re-ran i18n:hash --write 2026-07-02, byte-identical |
| `src/guide/content.generated.ts` | W1 re-ran wiki:content 2026-07-02; W2 re-ran 2026-07-02; both byte-identical (no commit needed) |
| `src/ui/i18n.status.summary.json` | W2 (2026-07-02, track/ip-world; i18n:gen side artifact) |
| `tests/parity/golden/{mob_locomotion,mob_swing_affixes,nythraxis_full_pull}.json` | W2 re-mint (2026-07-02, UPDATE_PARITY=1; inspector 0 violations; state-hash deltas proven by rename_state_proof) |

## Decisions & gotchas (honor across all sessions)
- **State-hash golden deltas (W2, ruling addendum implemented 2026-07-02):** aura display
  names land in sampled entity/player state, so a rename shifts per-frame golden `state`
  digests (not just `events`). The inspector now takes `--allow-state-hashes` (counts
  `frames.<i>.state` hex deltas separately; everything else stays strict) and those deltas
  are sanctioned ONLY when `RENAME_PROOF=1 npx vitest run tests/parity/rename_state_proof.test.ts`
  is green PRE-COMMIT (re-records changed scenarios, reverse-maps every string leaf new->old
  via the LOCKED map, re-digests, asserts byte equality with the `git show HEAD:` hashes;
  rng/draws/nextId/tick/time/label must be identical). Post-commit the proof passes vacuously
  (no goldens differ from HEAD). C1/C2 and the Phase-5 integrator re-mint should reuse both.
- **W2 shared-string scope note:** `src/sim/encounters/nythraxis.ts` carried two more inline
  `name: 'War Stomp'` literals (transition stun auras). The `AURA_NAME_KEY` matcher keys off
  the STRING, so they renamed with the same locked pair in W2 (S3 co-location); aura ids and
  values untouched. QA should also drive the Nythraxis 70% transition.
- **W2 REQUEST ROW (operator):** `deathstalker_voss.cleave.name` = 'Deathstalker Cleave'
  (zone3.ts) has no NAME-MAP row; the armed 'Cleave' entry still substring-hits it in an aura
  field. W2 did not coin a name. Needs a map row (or an operator keep/scope decision) before Z1.
- **Reword-staleness trap (Z1 + release):** rewording an existing English key does NOT flip its
  20 locale rows to `pending`; CI stays green while every non-English overlay renders the OLD
  (WoW) name. Do NOT try to fix overlays in a track (contributor rule: English only). Z1 writes
  the maintainer a reconciliation note (diff `i18n.resolved.generated/en.ts` merge-base vs HEAD;
  re-fill every locale whose value did not also change) for the release-tier fill.
- **Coined-id sweep is the ONLY id change.** C1 (family `murloc`/`kobold`) and C2 (warlock pet
  ids) rename ids atomically; a parity golden may shift by EXACTLY the renamed token (inspector
  verifies). Every other slice freezes every id and leaves all goldens byte-identical.
- **Two English copies for abilities/items** (sim record + catalog) must stay byte-identical or
  `i18n_resolved_equivalence` reds. Talent names must equal an ability name or carry a title
  override (V2).
- **S3 co-location:** W2 (mob mechanic names) and C1 (quest prose) update `src/ui/sim_i18n.ts` in
  the SAME slice as the emit-literal edit, then run the S3 guard.
- **Residuals OUTSIDE the scanner's net (G0 coverage review, 2026-07-02) — Z1's doc pass must
  sweep these by hand:** the resolved table's `guide` section carries player-visible prose
  mentioning "murloc" and "imp" (`i18n.resolved.generated/en.ts` guide entries), and UI strings
  carry a verbatim "Righteous Fury" and a lowercase "judgement" (stat/tooltip copy). The scanner
  prose-scan is deliberately scoped to quest/greeting + entity fields (per the G0 brief), so
  these will NOT redden `ip_scrub`; scanner-green does not equal zero-residual for them. These
  regenerate from source via `i18n:gen`, so the V-track renames may clear some automatically —
  Z1 verifies by hand either way. Owner: T1/Z1.
- **The C2 pet denylist arms all 7 roster names** (incl. the generic-fantasy Imp / Succubus /
  Infernal) because the operator decision is to re-theme the WHOLE set. If that decision changes
  at NAME-MAP lock, those three are hardcoded in the scanner and need a deliberate edit there,
  not just a map flip (documented in the test header).
