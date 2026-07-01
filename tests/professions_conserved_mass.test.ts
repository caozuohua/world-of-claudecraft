import { describe, expect, it } from 'vitest';
import { adjacentCrafts, CRAFT_RING, oppositeCraft } from '../src/sim/content/professions';
import {
  CRAFT_SKILL_BUDGET,
  CRAFT_SKILL_MAX,
  emptyCraftSkills,
  gainCraftSkill,
} from '../src/sim/professions/wheel';

// Regression coverage for issue #1129 (conserved-mass wheel: budget and
// opposite-craft drain). Flagged in the epic notes as the design doc's most
// fragility-flagged mechanic, so this file exercises every acceptance
// criterion directly against `gainCraftSkill` rather than relying on
// incidental coverage from the crafting-resolution tests.

function totalSkill(skills: Record<string, number>): number {
  return Object.values(skills).reduce((sum, v) => sum + v, 0);
}

describe('conserved-mass wheel (#1129)', () => {
  it('common-tier crafting produces zero drain', () => {
    const skills = emptyCraftSkills();
    // Fill every other craft with skill first, then push armorcrafting hard at
    // the common tier: nothing else may move.
    for (const craft of CRAFT_RING) {
      if (craft.id !== 'armorcrafting') skills[craft.id] = 20;
    }
    const before = { ...skills };
    gainCraftSkill(skills, 'armorcrafting', 50, 'common');
    expect(skills.armorcrafting).toBe(50);
    for (const craft of CRAFT_RING) {
      if (craft.id === 'armorcrafting') continue;
      expect(skills[craft.id]).toBe(before[craft.id]);
    }
  });

  it('gaining skill at uncommon+ tier never drains when under budget', () => {
    const skills = emptyCraftSkills();
    gainCraftSkill(skills, 'armorcrafting', 30, 'uncommon');
    expect(skills.armorcrafting).toBe(30);
    for (const craft of CRAFT_RING) {
      if (craft.id === 'armorcrafting') continue;
      expect(skills[craft.id]).toBe(0);
    }
    expect(totalSkill(skills)).toBeLessThanOrEqual(CRAFT_SKILL_BUDGET);
  });

  it('pushing a craft to uncommon+ measurably lowers its OPPOSITE craft first', () => {
    const skills = emptyCraftSkills();
    const opposite = oppositeCraft('armorcrafting').id;
    const [adjA, adjB] = adjacentCrafts('armorcrafting');
    // Spread the whole budget evenly across the nine other crafts so there is
    // mass everywhere to drain from, including the opposite craft and both
    // ring-adjacent crafts.
    const others = CRAFT_RING.filter((c) => c.id !== 'armorcrafting');
    const each = CRAFT_SKILL_BUDGET / others.length;
    for (const craft of others) skills[craft.id] = each;

    gainCraftSkill(skills, 'armorcrafting', 20, 'rare');

    // The opposite craft lost skill.
    expect(skills[opposite]).toBeLessThan(each);
    // The opposite craft lost STRICTLY more than the two ring-adjacent crafts
    // (drain priority favors the least-related craft first).
    expect(each - skills[opposite]).toBeGreaterThan(each - skills[adjA.id]);
    expect(each - skills[opposite]).toBeGreaterThan(each - skills[adjB.id]);
    // The total budget is never exceeded.
    expect(totalSkill(skills)).toBeLessThanOrEqual(CRAFT_SKILL_BUDGET);
  });

  it('drain proceeds strictly by ring distance: farther crafts empty before closer ones', () => {
    const skills = emptyCraftSkills();
    const others = CRAFT_RING.filter((c) => c.id !== 'armorcrafting');
    // Give every other craft the same starting stock, then push armorcrafting
    // with an overage bigger than any single craft can absorb, forcing the
    // drain to spill from the opposite craft into the next-farthest ones.
    for (const craft of others) skills[craft.id] = 20;
    skills.armorcrafting = 0;

    gainCraftSkill(skills, 'armorcrafting', 50, 'epic');

    const opposite = oppositeCraft('armorcrafting').id;
    const [adjA, adjB] = adjacentCrafts('armorcrafting');
    // The opposite craft (ring distance 5, least related) is drained down to
    // (or toward) zero before the two ring-adjacent crafts (distance 1) lose
    // anything at all.
    expect(skills[opposite]).toBeLessThan(20);
    expect(skills[adjA.id]).toBe(20);
    expect(skills[adjB.id]).toBe(20);
    expect(totalSkill(skills)).toBeLessThanOrEqual(CRAFT_SKILL_BUDGET);
  });

  it('the at-most-two-adjacent cap holds under a scripted crafting sequence', () => {
    const skills = emptyCraftSkills();
    // Repeatedly push armorcrafting and its adjacent craft (weaponcrafting) up
    // at the rare tier, as a player who keeps crafting the same two adjacent
    // recipes would. Both should be able to reach the per-craft max, since the
    // budget is exactly two crafts' worth of skill and adjacent crafts drain
    // last.
    for (let i = 0; i < 40; i++) {
      gainCraftSkill(skills, 'armorcrafting', 10, 'rare');
      gainCraftSkill(skills, 'weaponcrafting', 10, 'rare');
    }
    expect(skills.armorcrafting).toBe(CRAFT_SKILL_MAX);
    expect(skills.weaponcrafting).toBe(CRAFT_SKILL_MAX);
    // Every other craft has been drained to 0: the total never exceeds the
    // shared two-craft budget.
    for (const craft of CRAFT_RING) {
      if (craft.id === 'armorcrafting' || craft.id === 'weaponcrafting') continue;
      expect(skills[craft.id]).toBe(0);
    }
    expect(totalSkill(skills)).toBe(CRAFT_SKILL_BUDGET);
  });

  it('the budget makes fully maxing three or more crafts at once mathematically impossible', () => {
    // The whole point of the cap: CRAFT_SKILL_BUDGET is exactly two crafts'
    // worth of skill, so three crafts at CRAFT_SKILL_MAX each (300) would
    // exceed it (200). Round-robin push three mutually-adjacent crafts (a
    // contiguous run on the ring) hard at the rare tier: whatever the drain
    // settles into, at most two of them may end up at the max at once, and
    // the shared total never exceeds the budget.
    const skills = emptyCraftSkills();
    const trio = ['armorcrafting', 'weaponcrafting', 'jewelcrafting'];
    for (let i = 0; i < 60; i++) {
      for (const craftId of trio) gainCraftSkill(skills, craftId, 10, 'rare');
    }
    expect(totalSkill(skills)).toBeLessThanOrEqual(CRAFT_SKILL_BUDGET);
    const maxedInTrio = trio.filter((id) => skills[id] === CRAFT_SKILL_MAX).length;
    expect(maxedInTrio).toBeLessThanOrEqual(2);
    // No craft anywhere ever exceeds its own ceiling either.
    for (const craft of CRAFT_RING) expect(skills[craft.id]).toBeLessThanOrEqual(CRAFT_SKILL_MAX);
  });

  it('per-craft skill is clamped at CRAFT_SKILL_MAX even with a huge single gain', () => {
    const skills = emptyCraftSkills();
    gainCraftSkill(skills, 'armorcrafting', 10_000, 'legendary');
    expect(skills.armorcrafting).toBe(CRAFT_SKILL_MAX);
  });

  it('an unknown craft id or non-positive amount is still a no-op at any tier', () => {
    const skills = emptyCraftSkills();
    gainCraftSkill(skills, 'not-a-craft', 5, 'rare');
    expect(Object.keys(skills).sort()).toEqual(CRAFT_RING.map((c) => c.id).sort());
    gainCraftSkill(skills, 'armorcrafting', 0, 'rare');
    gainCraftSkill(skills, 'armorcrafting', -5, 'rare');
    expect(skills.armorcrafting).toBe(0);
  });
});
