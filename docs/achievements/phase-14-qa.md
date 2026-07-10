# 14 QA: the recheck missed nothing in the range

STATUS: NOT STARTED

Read `docs/achievements/overview.md` first (authoritative), then the 14
implement file and its progress.md row. This session verifies the recheck
with fresh eyes; its center of gravity is RANGE COMPLETENESS, because a
recheck's failure mode is silence (a system nobody judged), not a bad block.
House rules: no em/en dashes or emojis anywhere; no "phase"/packet wording in
anything that ships; English-only i18n, pending rows expected.

## 0. Orient

Read the 14 session summary in progress.md, the new resolutions entry in
`catalog/README.md`, and the diff since the 13Q closing sha.

## 1. Re-run acceptance (all of it, from a clean tree)

Every command in the 14 Acceptance section verbatim, real exit codes,
`npm run gate` UNPIPED.

## 2. Range-completeness audit (the load-bearing check)

- INDEPENDENTLY re-derive the audit range: `git log --merges` from the 09
  baseline (db71dad6d) to HEAD, then the content-affecting file inventory of
  that range. Do this from scratch; do not start from the 14 session's list.
- For every system or content record in the derived inventory: find its deed,
  its written rejection, or its deferral recheck in the resolutions entries.
  Anything with none of the three is a finding.
- Verify each rejection's REASON against the tree (a rejection citing absent
  wiring must grep clean; one citing rule 6 must actually be
  attendance-shaped).
- Re-verify the standing deferrals live: enchanting/salvage wiring still
  absent (or correctly transcribed if it landed), recipes for
  jewelcrafting/inscription, the account-level lane.

## 3. Fidelity audit (only if 14 transcribed anything)

- Scripted recount of deeds.ts vs the new resolutions totals, exact.
- Every new block transcribed 1:1; zero invented, zero silently dropped.
- Every pre-existing DEED_ORDER id byte-identical in place (diff the
  extracted order against the pre-14 sha).
- New grant sites driven by hand through the public Sim entry points
  (outcome-not-attempt, literal thresholds, retro behavior); at least two
  mutations redded and restored byte-clean.
- Icon-brief lines exist for exactly the new ids; Steam map pins updated and
  under the cap.

## 4. i18n and wiki mechanics

- No locale overlay touched; deed_i18n manifest covers any new ids
  automatically (confirm by count, not assumption).
- `npm run wiki:content` diffless on the committed tree; new public deeds
  appear, hidden additions do not.
- If any English key changed, the sha256 baseline moved in the SAME commit
  (check the commit graph).

## 5. Reviewer dispatch

Read the 14 reviewer verdicts and resolve anything open. Dispatch a fresh
qa-checklist over the 14 diff if 14 amended after its own dispatch, or if 14
was docs-only and its reviewer coverage was thin.

## 6. Adversarial what-is-missing pass

- Did any merge land BETWEEN the 14 session's pre-work merge and this
  session? If yes, extend the range audit over it now (this QA absorbs it or
  records it for a follow-up recheck; never leave it unjudged).
- Could two deeds now pay for one action outside the accepted subset-nesting
  pattern?
- Does the zero-additions verdict (if 14 concluded that) survive your own
  independent read of the range?

## Exit criteria

Acceptance green from a clean tree, range completeness proven independently,
fidelity audit clean (or vacuously so), mutations redded where code landed,
progress.md row 14Q written.

## End of session

Update progress.md row 14Q. Name the next file:
`docs/achievements/phase-15-wiki-audit.md`.
