# i18n Scaling - implementation packet

Make i18n reliable, clean, scalable, and well-architected so that an **English-only PR compiles and passes CI** (zero non-English tokens authored by the contributor), the full 14-locale fill happens **once at release** from a cheap per-locale delta, and **no English is ever silently shipped** to a translated player. This packet implements the RFC at `docs/design/i18n-translation-scaling.md` with four maintainer-locked decisions: a two-tier (PR/release) CI gate, a dense generated artifact that preserves `tsc` safety, **flat dotted-key overlays** for the 13 non-English locales (`en` stays nested), and a `t()` that throws on untracked keys in dev/test while rendering English for registry-`pending` keys on non-release builds only.

This is cross-session scaffolding, not a shipping artifact. The final QA phase offers to delete `docs/i18n-scaling/` before the PR.

## Read these first
- [`brainstorm.md`](brainstorm.md) - problem, root cause, approved vision, current state, reusable infra, OPEN items.
- [`state.md`](state.md) - the cross-phase cheat sheet: locked decisions, invariants, validation matrix, file paths, the byte-equivalence safety net. **Read before every phase.**
- [`implementation-plan.md`](implementation-plan.md) - TOC, canonical per-phase workflow, agent scaling, phase summary table.
- [`progress.md`](progress.md) - live status + per-phase deliverable/acceptance checklists.
- [`qa-checklist.md`](qa-checklist.md) - whole-feature integration QA matrix, verified at packet completion.
- Design source of truth: [`../design/i18n-translation-scaling.md`](../design/i18n-translation-scaling.md).

## Phases (implement -> QA pairs)
1. [Foundation & monolith split](phase-01-foundation-split.md) · [QA](phase-01-qa.md)
2. [Dense resolved artifact](phase-02-resolved-artifact.md) · [QA](phase-02-qa.md)
3. [Flatten non-English locales](phase-03-flatten-overlays.md) · [QA](phase-03-qa.md)
4. [Dialect inheritance dedup](phase-04-dialect-inheritance.md) · [QA](phase-04-qa.md)
5. [Status registry + scanner](phase-05-status-registry.md) · [QA](phase-05-qa.md)
6. [The unlock: relax types + two-tier CI](phase-06-unlock-two-tier.md) · [QA](phase-06-qa.md) - **English-only PRs become legal here**
7. [Release fill worklist + docs](phase-07-release-fill-tooling.md) · [QA](phase-07-qa.md)
8. [Admin catalog into the model](phase-08-admin-catalog.md) · [QA](phase-08-qa.md)
9. [`en_XA` pseudo-locale](phase-09-pseudo-locale.md) (optional) · [QA + packet teardown](phase-09-qa.md)

Phases 1-6 deliver the core goal; 7-8 make the release/admin workflow ergonomic; 9 is optional hardening. Stop after any QA gate.

## To start
Copy the **Starter Prompt** block from `phase-01-foundation-split.md` into a fresh Opus 4.8 Claude Code session. Then run `phase-01-qa.md` in another fresh session. Repeat down the list.
