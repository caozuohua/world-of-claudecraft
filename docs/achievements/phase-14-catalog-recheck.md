# 14: Catalog recheck, the content that merged during the polish round

STATUS: NOT STARTED

Read `docs/achievements/overview.md` FIRST; it is authoritative and its sections 2
(glossary), 3 (canonical identifiers), and 5 (binding rules) apply verbatim here.
Then read `docs/achievements/catalog/README.md` in full, especially the Hard rules
and BOTH Assembly resolutions sections (2026-07-08 and the polish round): they
still govern every block you author, and this session APPENDS dated resolutions,
it never rewrites old ones.

Reminder that binds every step: the word "phase", packet references, em dashes,
en dashes, and emojis never appear in any shipped artifact (code, comments,
commit messages). English-only i18n via the pending mechanism.

## Goal

Session 09 re-reviewed the catalog against the tree as of 2026-07-09
(db71dad6d). The polish round then ran for two more days while release/v0.24.0
kept merging in: five release merges have landed on this branch since the 09
baseline (ab0d9745c, c6c3fa634, 318b11b0f, 77cde32b4, ab04c265b), and the
session's own pre-work merge will bring more. This session repeats the 09
methodology over exactly that range so the catalog freezes against the FINAL
tree before the wiki audit (15) and the translation fill (16). By the end,
every player-reachable system or piece of content that entered the branch
since db71dad6d has deliberate deed coverage or a written no-action
resolution, and the maintainer's icon brief covers any new ids.

## Context to load before writing anything

- `docs/achievements/overview.md` sections 3, 4, 5, 6 and
  `docs/achievements/catalog/README.md` end to end (the entry format is
  mandatory; resolutions 15 no-retro-edit, 20 inert-system class, and 21
  enchanting recheck bind this session directly).
- Derive the audit range LIVE, do not trust this file's list: the 09 baseline
  is db71dad6d; `git log --merges db71dad6d..HEAD` names every release merge,
  and the pre-work merge this session performs extends the range. Inventory
  the content-affecting delta: `git diff --name-only db71dad6d..HEAD --
  src/sim/content/ src/sim/professions/ src/sim/` plus any new
  player-reachable mechanic named in the merge commit subjects.
- `src/sim/content/deeds.ts` (DEED_ORDER is append-only; 192 live ids as of
  13Q), `src/sim/deeds.ts` (the evaluator and existing counters),
  `tests/deeds_content.test.ts` + `tests/deeds_sites.test.ts` (the pin and
  site-coverage patterns to extend).
- `server/steam/achievement_map.ts` (72 of 100 slots used as of 13Q; the map
  is append-only and pinned).
- `scripts/wiki/build_content.mjs` + `tests/guide.test.ts` (a catalog change
  without a committed regen fails the gate).

## Known range inventory (starting worklist; re-derive and judge live)

Content and systems the five merges brought, each needing a deed or a written
rejection. The pre-judgments below are HYPOTHESES to verify against the tree
and the hard rules, never conclusions to copy:

1. The enchanting profession (disenchant, apply-enchant, the ENCHANTS table):
   resolution 21 already defers all enchanting deeds because neither action
   has player-facing wiring on any host. RE-VERIFY that wiring is still
   absent (an upstream merge may have landed it since); if it landed, the
   deferred designs get their transcription review here.
2. The in-game jail and moderation surfaces: being jailed is a punishment and
   catalog rule 6 forbids rewarding griefing; a deed on either side of the
   jail likely fails the outcome test. Expect a written rejection.
3. Heroic loot flair, soulbound items, shared-personal marks: loot-delivery
   mechanics. Check whether any creates a countable player OUTCOME that is
   not drop-luck gated (rule 2 forbids luck); the heroic mark circuit already
   feeds existing dgn_ coverage via the 12-round heroicOf normalization.
4. The /playtime lifetime readout: attendance-shaped, rule 6 territory.
   Expect a written rejection.
5. Native Discord auth, Apple sign-in, password reset, SES mail: account
   plumbing, no gameplay outcome. One-line rejections.
6. Queued-cast ability, warlock pet resummon, buff no-stack, min-range,
   mailbox parcel quantity, mobile autorun lock, wire/perf fixes: QoL and
   balance retunes; the heroic-equalization precedent (09 rejection list)
   applies. One-line rejections unless the tree says otherwise.
7. Anything the pre-work merge adds: inventory it the same way.

Also re-verify the standing deferrals as of THIS tree and record the recheck:
prog_ringwright, soc_first_salvage/soc_salvage_50, the nine account-level ids
(the account-grant lane in server/deeds_records.ts is still observer-only
unless something changed).

## Design spec

1. Catalog docs first, code second: any new deed is authored as a block in
   the matching `docs/achievements/catalog/*.md` file before deeds.ts sees
   it. Append a dated resolutions entry recording the audited range, every
   addition, every rejection with its reason, and the deferral rechecks.
2. The no-retro-edit rule (resolution 15) binds in full: existing triggers,
   renown values, names, descs, and DEED_ORDER positions never change;
   coverage gaps close with NEW deeds only.
3. Renown budget: this is a recheck, not a content drop; ZERO additions is a
   legitimate outcome if every in-range system has a written resolution. If
   additions are warranted, stay within 0 to 60 new Renown and record exact
   new totals (deeds, Renown, titles, borders, Steam) against a scripted
   recount.
4. Any transcription follows the 09 wiring standard: append-only DEED_ORDER,
   new counters initialized + persisted + bumped via append-only SimContext
   callbacks at the real resolution sites, decisive tests (literal
   thresholds, negative arms, retro-on-join where predicates apply), Steam
   names only for marquee-quality spoiler-safe additions, wiki regen and any
   i18n sha256 re-baseline in the SAME commit.
5. New ids get icon-brief lines appended to
   `docs/achievements/catalog/new-deeds-icon-brief.md` in the maintainer's
   format; new deeds ship on the procedural category crest until art lands.

## Out of scope

- Wiki prose or page changes beyond the mechanical regen (session 15 owns the
  wiki audit).
- Translations (session 16).
- Any edit to existing deed triggers, renown, or order.
- The account-level grant lane and enchanting/salvage wiring (build nothing;
  recheck and record).

## Steps

1. Pre-work: merge the latest origin/release/v0.24.0 per the standing rule
   (release-merge-audit, regen discipline, sha256 --write if the baseline
   moves).
2. Derive the range and its content inventory; verify every hypothesis above
   against the tree.
3. Author blocks + the dated resolutions entry (+ icon-brief lines) for
   anything that earns a deed; write rejections for everything else.
4. Transcribe and wire any additions with their tests; regen wiki/i18n.
5. Biome on touched files; targeted vitest; `npm run gate` UNPIPED.
6. Update `docs/achievements/progress.md` row 14; commit with explicit paths,
   scope `deeds` (or `docs` if the session lands zero code).

## Acceptance (all must pass)

- `npx vitest run tests/deeds_content.test.ts tests/deeds.test.ts tests/deeds_sites.test.ts tests/deed_i18n.test.ts`
- `npx vitest run tests/architecture.test.ts tests/localization_fixes.test.ts`
- `npx vitest run tests/guide.test.ts` (freshness green on the committed tree)
- The Steam map pin suite (locate it; do not guess the filename).
- `npm run gate` UNPIPED, exit 0.
- The new resolutions entry records totals matching a scripted recount of
  deeds.ts exactly, and names every merge in the audited range.
- If any deed was added: its icon-brief line exists and
  `tests/deeds_content.test.ts` pins it.

## Reviewer dispatch (fresh agents, never the implementer)

- architecture-reviewer over any sim diff (zero rng, tick-tail placement,
  append-only SimContext).
- test-coverage-auditor over any new tests (decisive pins, negative arms).
- If the session lands zero code: qa-checklist over the docs diff instead.

## Adversarial pass (answer each in the session summary)

1. Re-derive the merge range independently at the END of the session (the
   pre-work merge moved HEAD): does the resolutions entry still name every
   merge, and did the pre-work merge itself bring content the inventory
   missed?
2. Can any new deed be earned by an attempt, a punishment endured, RNG, or
   attendance rather than a real outcome?
3. Did DEED_ORDER stay byte-identical for every pre-existing id?
4. Is every rejection written where the next recheck will find it (the dated
   resolutions entry, not a commit message)?
5. Does anything in the diff contain a dash, emoji, or packet vocabulary?

## End of session

Update `docs/achievements/progress.md` row 14 with the dense one-line summary
(commit sha, range audited, additions or the zero-additions verdict,
rejections count, reviewer verdicts, flags). Name the next file:
`docs/achievements/phase-14-qa.md`.
