# 13 QA: the docs route the next contributor correctly

STATUS: NOT STARTED

Read `docs/achievements/overview.md` first (authoritative), then the 13
implement file and its progress.md row. House rules: no em/en dashes or
emojis; no "phase"/packet wording in anything that SHIPS (packet files
exempt); English-only i18n, pending rows expected.

## 0. Orient

Read the 13 session summary and the diff (README, all CLAUDE.md touchpoints,
docs/design/deeds.md, docs/CLAUDE.md, the screenshot script, the screenshots
directory).

## 1. Re-run acceptance (all of it, from a clean tree)

Every command in the 13 Acceptance section verbatim, real exit codes,
`npm run gate` UNPIPED.

## 2. Doc factual audit (the load-bearing check)

Pick TEN factual claims across the new docs (file paths, table names, test
names, rule numbers, key names) and verify each against the tree. Any
mismatch is a finding. Specifically verify:

- Every file path named in docs/design/deeds.md exists.
- The renown scale, trigger vocabulary, and deferral list match
  catalog/README.md and the code.
- The root CLAUDE.md rule says "Every" (literal scope), names the same-change
  requirement, and points at docs/design/deeds.md.
- The README bullets contain no exact numbers or formulas (marketing
  altitude) and say "classic", never a trademark.
- server/CLAUDE.md persistence parenthetical matches the real
  CharacterState keys (deeds, deedStats, activeTitle, renown).

## 3. The routing walkthrough (fresh-eyes simulation)

As if you were a new session told "add a new dungeon": start from root
CLAUDE.md only, follow the docs, and write down the step list you end up
with. It must include authoring deeds, the wiki regen, and the icon-brief
line for the maintainer, without reading this packet. If the trail breaks
anywhere, fix the doc in this session.

## 4. Screenshot evidence audit

- Open EVERY screenshot (not five): correct surface, correct viewport
  proportions, icon art visible where claimed, no intro overlay, no devtools
  chrome, no personal info beyond the test character.
- Index README rows match the files one-to-one; tree sha recorded.
- Re-run the script: same file set, no orphan outputs.
- Mobile frames were captured via raw CDP (read the script; page.setViewport
  alone is a finding).

## 5. Hygiene audit

- `grep -rn 'phase' docs/design/deeds.md README.md CLAUDE.md src/sim/CLAUDE.md src/sim/content/CLAUDE.md src/ui/CLAUDE.md server/CLAUDE.md src/guide/CLAUDE.md`
  returns zero hits.
- Perl dash/emoji scan over every touched shipped file.
- AGENTS.md/GEMINI.md (if present) are thin pointers and needed no edit;
  confirm.

## 6. Reviewer dispatch

Read the 13 reviewer verdicts and resolve anything open. Dispatch
qa-checklist fresh if 13 amended after its dispatch.

## 7. Adversarial what-is-missing pass

- Is there a doc surface contributors actually read that still lacks deeds
  (server/http/CLAUDE.md? docs/prd/? the PR template?) and does it NEED it,
  or is the omission correct? Record the judgment.
- Does any new doc contradict the cosmetic-only guarantee or the
  graphics-fairness rules?
- Will the screenshots mislead later (staged states presented as defaults)?

## Exit criteria

Acceptance green from clean tree, ten-claim audit clean, routing walkthrough
produces the right step list, every screenshot verified, hygiene scans
clean, progress.md row 13Q written.

## End of session

Update progress.md row 13Q. Name the next file:
`docs/achievements/phase-14-catalog-recheck.md`. (The next file was
`phase-14-translations.md` when this session ran; the maintainer then
inserted the catalog recheck and wiki audit sessions, renumbering
translations to 16.)
