// Flat per-craft skill tracking (issue #1126) plus the conserved-mass wheel rule
// (issue #1129). A player has one independent skill value for each of the ten
// crafts on the ring (see content/professions.ts). Below the uncommon tier, gains
// stay purely additive (issue #1126's original behavior). From the uncommon tier
// upward, a gain that would push the ten-craft total over the shared budget
// (`CRAFT_SKILL_BUDGET`) drains the overage back out of the OTHER nine crafts,
// prioritizing whichever craft is least related on the ring: the opposite craft
// (ring distance 5) drains first, then progressively closer crafts, with the two
// ring-adjacent crafts (distance 1) drained last of all. Since the budget is
// exactly two crafts' worth of skill, this naturally caps a player at fully
// maxing at most two (adjacent, because they are the last drained) crafts, or
// spreading the same budget thinner across three or more at a reduced level.
//
// Free-floor rule: crafting at the common tier never costs anything. A caller
// that never passes a tier (or passes 'common') gets the original #1126 additive-
// only behavior with no drain, so every pre-#1129 caller/test keeps working
// unchanged.
//
// This module is `src/sim`-pure (see src/sim/CLAUDE.md): no DOM/render/ui/game/net
// imports, no Math.random/Date.now, host-agnostic so it runs offline, on the
// server, and in the headless RL env unchanged.

import { CRAFT_RING } from '../content/professions';
import type { SimContext } from '../sim_context';
import { MATERIAL_RARITY_MAX_PROFICIENCY, type MaterialRarity } from './gathering';

/** Per-craft skill ceiling: the same ladder-max used to weight the material-rarity
 *  roll (see gathering.ts), reused here as the point past which a craft cannot
 *  gain further skill. */
export const CRAFT_SKILL_MAX = MATERIAL_RARITY_MAX_PROFICIENCY;

/** Total conserved-mass budget shared across all ten crafts: exactly two crafts'
 *  worth of skill. A player can fully max at most two crafts (adjacent ones, since
 *  the drain priority below always empties farther crafts first), or spread the
 *  same budget thinner across three or more crafts at a reduced level each. */
export const CRAFT_SKILL_BUDGET = CRAFT_SKILL_MAX * 2;

/** Per-craft skill values, keyed by CraftDef.id. Every craft is always present. */
export type CraftSkills = Record<string, number>;

/** A fresh all-zero skill record covering every craft on the ring. */
export function emptyCraftSkills(): CraftSkills {
  const skills: CraftSkills = {};
  for (const craft of CRAFT_RING) skills[craft.id] = 0;
  return skills;
}

/** Backfill a persisted/partial record so every ring craft has an entry, without
 *  disturbing any value already present (additive back-compat: an older save with
 *  fewer or zero craft keys loads cleanly at 0 for the missing ones). */
export function normalizeCraftSkills(
  saved: Record<string, number> | undefined | null,
): CraftSkills {
  const skills = emptyCraftSkills();
  if (!saved) return skills;
  for (const craft of CRAFT_RING) {
    const value = saved[craft.id];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) skills[craft.id] = value;
  }
  return skills;
}

/** Ring distance between two crafts (0..5, the ring's half-size), the shorter way
 *  around the ten-position circle. Distance 5 is exactly opposite. */
function ringDistance(craftId: string, otherId: string): number {
  const a = CRAFT_RING.findIndex((c) => c.id === craftId);
  const b = CRAFT_RING.findIndex((c) => c.id === otherId);
  if (a < 0 || b < 0) return 0;
  const raw = Math.abs(a - b);
  return Math.min(raw, CRAFT_RING.length - raw);
}

/** Every other craft on the ring, ordered by drain priority: farthest (least
 *  related, the opposite craft first) to nearest (the two ring-adjacent crafts
 *  drain last of all). Ties at equal ring distance keep the ring's own order. */
function drainPriorityOrder(craftId: string): string[] {
  return CRAFT_RING.filter((c) => c.id !== craftId)
    .map((c) => c.id)
    .sort((a, b) => ringDistance(craftId, b) - ringDistance(craftId, a));
}

/** Drains whatever the ten-craft total currently exceeds `CRAFT_SKILL_BUDGET` by,
 *  taking it out of every OTHER craft (never `craftId`, the one that just gained)
 *  in ring-distance-descending order: the opposite craft first, then progressively
 *  closer crafts, with the two ring-adjacent crafts drained last. Stops as soon as
 *  the overage is paid off or every other craft has been drained to 0. */
function drainConservedMass(skills: CraftSkills, craftId: string): void {
  let overage = 0;
  for (const id of Object.keys(skills)) overage += skills[id];
  overage -= CRAFT_SKILL_BUDGET;
  if (overage <= 0) return;
  for (const otherId of drainPriorityOrder(craftId)) {
    if (overage <= 0) break;
    const drain = Math.min(skills[otherId], overage);
    skills[otherId] -= drain;
    overage -= drain;
  }
}

/** Skill gain for exactly one craft, clamped at `CRAFT_SKILL_MAX`. A non-positive
 *  amount, or an unknown craft id, is a no-op; skill never goes negative.
 *
 *  `tier` is the rarity tier of the craft action that earned this gain (the rolled
 *  output quality, see professions/crafting.ts): at the default 'common' tier the
 *  gain is purely additive and never touches any other craft (issue #1126's
 *  original free-floor behavior). From 'uncommon' upward, any overage past the
 *  shared `CRAFT_SKILL_BUDGET` is drained out of the other nine crafts, opposite-
 *  craft first (see `drainConservedMass`). */
export function gainCraftSkill(
  skills: CraftSkills,
  craftId: string,
  amount: number,
  tier: MaterialRarity = 'common',
): void {
  if (!(craftId in skills) || !(amount > 0)) return;
  const capped = Math.min(CRAFT_SKILL_MAX, skills[craftId] + amount);
  if (capped <= skills[craftId]) return;
  skills[craftId] = capped;
  if (tier === 'common') return;
  drainConservedMass(skills, craftId);
}

/** Read surface: a copy of a player's ten craft skill values, keyed by craft id.
 *  Backs the IWorld `craftSkills` read (progression_xp facet). */
export function craftSkillsFor(ctx: SimContext, pid: number): CraftSkills {
  const meta = ctx.players.get(pid);
  return meta ? { ...meta.craftSkills } : emptyCraftSkills();
}
