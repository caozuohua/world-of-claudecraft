import type { DeedStats } from '../sim/types';

// ---------------------------------------------------------------------------
// The Book of Deeds (the deeds system): the SELF player's earned deeds,
// persisted lifetime stat block, Renown total, and displayed title. All four
// reads mirror sim state the evaluator (src/sim/deeds.ts) maintains; the one
// command requests a title change, which the sim validates (the deed must be
// earned and carry a title reward; null clears; invalid input is a silent
// no-op). Offline the Sim exposes its live per-player state (the questLog
// precedent); online the ClientWorld mirrors the snapshot self keys
// (`deeds`/`dstats` heavy-gated, `renown`/`atitle` per-tick diffed) and the
// `deedUnlocked` event stays presentation-only. Other players' titles are not
// here: they ride the entity wire (`title`, a deed id) for nameplates/inspect.
// ---------------------------------------------------------------------------

export interface IWorldDeeds {
  // Deed id -> the utcDay it was earned ('YYYY-MM-DD', '' when the host set
  // no calendar), for the SELF player. Readonly across the seam: consumers
  // never mutate deed state.
  deedsEarned: ReadonlyMap<string, string>;
  // The persisted lifetime counter block (counters, discovery + visit sets,
  // per-dungeon clears) backing progress readouts.
  deedStats: Readonly<DeedStats>;
  // The self player's current Renown total, exactly the denormalized sum the
  // evaluator maintains.
  renown: number;
  // The selected display title: a deed id (never display text), null when
  // untitled.
  activeTitle: string | null;
  // Request a title change (null clears). No optimistic local write online:
  // the mirror updates from the snapshot echo once the sim accepts.
  setActiveTitle(deedId: string | null): void;
}
