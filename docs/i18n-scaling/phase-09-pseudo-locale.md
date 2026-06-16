# Phase 9 (OPTIONAL) - en_XA dev-only pseudo-locale

Add a generated, dev-only pseudo-locale `en_XA` that accent-pushes and brackets every `en`
leaf, selectable via `?lang=en_XA`, and excluded from `supportedLanguages`, hreflang, and the
release gate. It is the ONLY mechanism that catches hard-coded literals that never became
`t()` keys, which is the one gap the type system cannot see: any on-screen text that is NOT
bracketed and accented under en_XA is an untranslated literal hiding in plain sight. This
phase is clearly OPTIONAL. It is high value, but the packet's core goal (English-only PR
passes CI, no silent English shipped) is already delivered by Phase 6; treat en_XA as a
quality amplifier, not a gate.

## Where this sits in the packet

After Phases 1-8 the i18n system is complete and load-bearing: nested `en`
(`src/ui/i18n.en.ts`), sparse flat dotted-key overlays (`src/ui/i18n.locales/<lang>.ts`),
the dense generated artifact (`src/ui/i18n.resolved.generated.ts`) that keeps `tsc` safety,
the registry (`src/ui/i18n.status.json`) plus scanner, the two-tier CI gate, the release fill
worklist, and the admin catalog under the same model. `supportedLanguages = Object.keys(translations)`.
The shipped locales are: en, es, es_ES, fr_FR, fr_CA, en_CA, it_IT, de_DE, zh_CN, zh_TW,
ko_KR, ja_JP, pt_BR, ru_RU (14). `index.html` carries hreflang links for those shipped locales.

Locked decisions this phase must respect: (1) two-tier CI gate (PR tier vs release tier);
(2) the dense generated artifact preserves `tsc` safety; (3) flat dotted-key overlays with
`en` nested; (4) `t()` semantics of throw-on-untracked-in-dev / English-for-pending-non-release
/ empty-pending at release. en_XA is layered on top of all of this and changes none of it.

Invariants for the whole packet: sim and server stay language-agnostic; determinism is
untouched; no new dependency or framework; generated files are never hand-edited; shared
worktree, so commit with EXPLICIT paths only.

Cheat sheet: `docs/i18n-scaling/state.md`. Status: `docs/i18n-scaling/progress.md`.
Whole-feature QA matrix: `docs/i18n-scaling/qa-checklist.md`.

---

## Implementation starter prompt

Paste the block below into a fresh Claude Code session.

```
This is Phase 9 (optional) of the i18n Scaling feature: en_XA dev-only pseudo-locale.

MODEL: Opus 4.8 (claude-opus-4-8). If you are a different or smaller model, drop to the
  Sonnet baseline: smaller verifiable steps, checkpoint before multi-file edits, one
  investigation subagent rather than a wide fan-out. Never gate invariants, safety, or
  correctness on the model identity line; when unsure, use the baseline.
HARNESS: ULTRACODE is NOT required for this phase. It is one generator plus selector wiring
  plus a handful of exclusions. Parallel Agent fan-out is optional and only worth it for the
  STEP 1 context gather and the STEP 3 review.

GOAL: Generate a dev-only `en_XA` pseudo-locale by transforming every `en` leaf (accent-push
  the letters, wrap in brackets, preserve {placeholders}), make it selectable via
  ?lang=en_XA in dev, and exclude it from every user-facing locale enumeration so it can
  never ship as a real locale.

STEP 0 - PRE-FLIGHT
  - Confirm the working tree is clean enough to isolate this phase's diff. This is a shared
    worktree: never `git add -A`; you will stage only the files you touch, by explicit path.
  - Scan memory / earlier-phase notes for anything that constrains en_XA (selector wiring,
    where the locale list is enumerated). Record the phase-start commit SHA so a later QA
    pass can diff "since phase start".

STEP 1 - LOAD CONTEXT
  Launch one Explore agent (read-only). Have it summarize and then report back precisely:
    - docs/i18n-scaling/state.md and docs/i18n-scaling/progress.md (current packet state,
      what Phases 1-8 delivered, any OPEN items).
    - This phase file (docs/i18n-scaling/phase-09-pseudo-locale.md).
    - The resolved-artifact build: scripts/i18n_build.mjs. How does it read `en` and the
      overlays and emit src/ui/i18n.resolved.generated.ts? What is the generation hook (the
      exact function/loop where a new locale would be produced)?
    - How language selection works: supportedLanguages, getLanguage, setLanguage, and the
      ?lang= query-param selector. What is the full path from "?lang=X in the URL" to "t()
      returns X's strings"? Where is the language picker UI populated from?
    - Where hreflang links are emitted (index.html) and where the release gate enumerates
      the shipping locales (the release tier of the two-tier CI gate, plus any 14-locale
      parity assertion in tests).
  The agent must return three lists explicitly:
    (a) THE GENERATION HOOK: the one place in scripts/i18n_build.mjs to add the en_XA
        transform.
    (b) THE LANGUAGE-SELECTION PATH: every function/branch ?lang= flows through, and how to
        make en_XA loadable in dev only.
    (c) EVERY PLACE THE LOCALE LIST IS ENUMERATED: supportedLanguages source, the hreflang
        list in index.html, the language picker population, the release gate, and any test
        that asserts 14-locale parity. en_XA must be excluded from every user-facing one.

STEP 2 - CHOOSE ORCHESTRATION + EXECUTE
  Orchestration: this is small. Do it inline (no fan-out needed for the edits). Steps:
    1. Extend scripts/i18n_build.mjs to generate `en_XA` by transforming every `en` leaf:
       - Accent-push the ASCII letters (a deterministic 1:1 map, e.g. a->a-with-accent,
         e->e-with-accent, etc.; non-letters pass through).
       - Wrap each leaf string in brackets, e.g. "[" + transformed + "]", so missing
         brackets are visually obvious on screen.
       - Preserve {placeholders} EXACTLY: do not accent or bracket the contents of any
         {name} / {count} / ICU-style token; transform only the literal text around them.
         Round-trip a couple of placeholder strings to confirm the tokens survive.
       - en_XA is GENERATED, never hand-authored. It lands in the generated artifact (or an
         equivalent generated file), not in src/ui/i18n.locales/.
    2. Make ?lang=en_XA selectable in DEV ONLY. The selector should accept en_XA when running
       in dev, but en_XA must not be a member of supportedLanguages and must not appear in
       the player-facing language picker. Keep the dev gate explicit (a dev/import.meta.env
       check, not a hard-coded build flag that could leak).
    3. EXCLUDE en_XA everywhere user-facing:
       - NOT in supportedLanguages (it is not in Object.keys(translations) for the shipped
         set; if the generated artifact would otherwise add it to translations, keep
         supportedLanguages derived from the 14 shipped locales only).
       - NOT in the hreflang list in index.html.
       - NOT in the release gate / 14-locale parity. The release tier must keep requiring
         exactly the 14 shipped locales; en_XA is neither required nor counted.
    4. Document usage (in this phase file's follow-up notes and in state.md): load
       ?lang=en_XA in dev, then scan the UI. Any text that is NOT bracketed and accented is
       a hard-coded literal that never became a t() key. Record each one you spot.

  INVARIANTS (must hold):
    - en_XA is generated, never hand-edited.
    - en_XA preserves {placeholders} untouched.
    - en_XA is excluded from every user-facing locale enumeration: supportedLanguages,
      hreflang (index.html), the release gate, and the 14-locale parity check.
    - en_XA never appears in the language picker for normal players.
    - No new dependency or framework. sim/server stay language-agnostic. Determinism
      untouched. Generated files are not hand-edited (regenerate via the build).
    - Commit with explicit paths only; no `git add -A`.

  OUT OF SCOPE:
    - Do NOT fix every literal en_XA reveals in this phase. That is follow-up work. This
      phase delivers the MECHANISM and REPORTS what it finds. Fixing the surfaced literals
      is recorded as deferred follow-ups, not done here.

STEP 3 - VALIDATION + REVIEW
  Run, in order:
    - npx tsc --noEmit  (green).
    - Load ?lang=en_XA via a screenshot script or the dev server and confirm strings render
      bracketed and accented across a few screens (login, HUD, a window or two, admin).
    - Confirm en_XA is NOT in supportedLanguages, NOT in the hreflang list, and NOT required
      or counted by the release gate / 14-locale parity.
    - npm run build  (green; en_XA generated as part of the artifact build).
    - npx vitest run tests/localization_fixes.test.ts tests/localization_coverage.test.ts.
  Then launch parallel review agents. These are COVERAGE reviews, not filtering: surface
  everything, do not pre-suppress.
    - privacy-security-review (does the dev-only gate actually prevent en_XA reaching
      production users; no secret/flag leak).
    - cross-platform-sync (en_XA behaves the same across the offline browser world, online
      client, and any headless path that touches t(); selector parity).
  If any agent output is truncated, resume it until complete (truncation-resume).
  REPORT the list of hard-coded literals en_XA surfaced, as deferred follow-ups, with enough
  location detail to act on later. Do NOT commit while any BLOCKING finding is open.

STEP 4 - COMMIT CADENCE (2 commits, explicit paths)
  1. feat(i18n): generate en_XA dev-only pseudo-locale
       - the build change (scripts/i18n_build.mjs), the regenerated artifact, the dev-only
         selector wiring.
  2. chore(i18n): exclude en_XA from supportedLanguages, hreflang, and release gate
       - the exclusion edits (supportedLanguages derivation, index.html hreflang, release
         gate / parity test).
  Stage each commit's files by explicit path. Verify `git status` shows nothing unexpected
  before each commit (shared worktree).

STEP 5 - ACCEPTANCE (all must be true)
  - en_XA is generated from en, with {placeholders} preserved exactly.
  - en_XA is selectable via ?lang=en_XA in dev.
  - en_XA is excluded from supportedLanguages, from hreflang, and from the release gate /
    14-locale parity.
  - Usage is documented (how to load it and how to read the result).
  - The list of literals en_XA surfaced is recorded as deferred follow-ups.
  - npx tsc --noEmit, the vitest localization suite, and npm run build are all green.

STEP 6 - DOC UPDATES
  - docs/i18n-scaling/progress.md: tick the Phase 9 checklist (mechanism delivered,
    exclusions verified, follow-up literals recorded).
  - docs/i18n-scaling/state.md: add row 9 to the additions log (en_XA generator + selector +
    exclusions) and record the surfaced-literals follow-up list so the QA/teardown phase can
    forward it.

STOPPING RULES
  - Stop and surface immediately if en_XA cannot be fully excluded from EVERY user-facing
    locale enumeration. A dev pseudo-locale leaking into production hreflang, into
    supportedLanguages, or into the player language picker is a defect, not a cosmetic issue.
  - Stop and surface if generating en_XA would force a hand-edit to a generated file or
    require a new dependency.
```

---

## Notes for the implementer

- en_XA is a quality tool, not a shipped product. Its entire reason to exist is to make the
  invisible visible: the type system already guarantees that every registered key is
  translated in every locale, but it cannot see a literal that was never turned into a key.
  en_XA makes those literals jump out because they alone stay plain ASCII with no brackets.
- Keep the accent map deterministic and 1:1 so the same `en` always yields the same en_XA;
  this keeps the generated artifact reproducible, consistent with the rest of the packet.
- This phase is OPTIONAL. If time-boxed out, the packet still meets its core goal. If done,
  it pays for itself the first time it surfaces a literal that would otherwise have shipped
  as silent English.
