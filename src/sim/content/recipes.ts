// Recipe content (issue #1127): common-tier crafting recipes, one or two per
// craft on the ring (src/sim/content/professions.ts CRAFT_RING). Data-as-code,
// exempt from module-first size rules per root CLAUDE.md (a declarative table,
// not logic): the resolution logic lives in ../professions/crafting.ts behind
// the SimContext seam.
//
// Scope: COMMON TIER ONLY. Every recipe below has skillReq 0 (the free floor:
// a common-tier recipe is craftable with zero craft skill, gated only by
// having the materials). Higher-tier gating (P4), the wheel (P5), and
// archetype-exclusive combos (P8) build on this path later; itemLevelBudget is
// carried now so those follow-ups have a stable field to read.
//
// Inputs are existing harvested-material item ids from the gathering content
// (src/sim/professions/gathering.ts NODE_HARVEST_TABLE): bone_fragments
// (mining), linen_scrap (logging), spider_leg (herbalism). Outputs reuse
// existing low-tier BASE_ITEMS entries (src/sim/content/items.ts) rather than
// introducing new item ids, to avoid expanding the positional item-name arrays
// in src/ui/i18n.catalog/items.ts for this issue.

import type { ProfessionRecipeRecord } from '../professions/types';

export const COMMON_RECIPES: ProfessionRecipeRecord[] = [
  {
    id: 'recipe_eastbrook_arming_sword',
    professionId: 'weaponcrafting',
    resultItemId: 'eastbrook_arming_sword',
    resultCount: 1,
    reagents: [
      { itemId: 'bone_fragments', count: 2 },
      { itemId: 'linen_scrap', count: 1 },
    ],
    skillReq: 0,
    trivialAt: 25,
    itemLevelBudget: 10,
  },
  {
    id: 'recipe_eastbrook_chain_vest',
    professionId: 'armorcrafting',
    resultItemId: 'eastbrook_chain_vest',
    resultCount: 1,
    reagents: [{ itemId: 'bone_fragments', count: 3 }],
    skillReq: 0,
    trivialAt: 25,
    itemLevelBudget: 10,
  },
  {
    id: 'recipe_eastbrook_wool_trousers',
    professionId: 'tailoring',
    resultItemId: 'eastbrook_wool_trousers',
    resultCount: 1,
    reagents: [{ itemId: 'linen_scrap', count: 3 }],
    skillReq: 0,
    trivialAt: 25,
    itemLevelBudget: 8,
  },
  {
    id: 'recipe_tanned_leather_jerkin',
    professionId: 'leatherworking',
    resultItemId: 'tanned_leather_jerkin',
    resultCount: 1,
    reagents: [
      { itemId: 'spider_leg', count: 2 },
      { itemId: 'bone_fragments', count: 1 },
    ],
    skillReq: 0,
    trivialAt: 25,
    itemLevelBudget: 9,
  },
  {
    id: 'recipe_tough_jerky',
    professionId: 'cooking',
    resultItemId: 'tough_jerky',
    resultCount: 1,
    reagents: [{ itemId: 'spider_leg', count: 1 }],
    skillReq: 0,
    trivialAt: 25,
    itemLevelBudget: 1,
  },
  {
    id: 'recipe_minor_healing_potion',
    professionId: 'alchemy',
    resultItemId: 'minor_healing_potion',
    resultCount: 1,
    reagents: [
      { itemId: 'linen_scrap', count: 1 },
      { itemId: 'spider_leg', count: 1 },
    ],
    skillReq: 0,
    trivialAt: 25,
    itemLevelBudget: 1,
  },
];

// Tier 4/5 tool recipes (#1135's crafted base tools), de-stubbed from the
// former `TOOL_RECIPE_STUBS` in content/professions.ts now that #1127's
// crafting action exists to consume them. Kept out of COMMON_RECIPES (whose
// module doc and tests fix skillReq at 0 for every entry): these carry a
// non-zero skillReq the way itemLevelBudget was already carried on the
// common-tier recipes above, i.e. a stable field for the #1128 mastery-gating
// follow-up to enforce. resolveCraft does not yet read skillReq (that gate is
// #1128's job), so these are craftable today purely on having the reagents,
// same as any common recipe, until #1128 lands.
export const TOOL_RECIPES: ProfessionRecipeRecord[] = [
  {
    id: 'recipe_thorium_mining_pick',
    professionId: 'engineering',
    resultItemId: 'thorium_mining_pick',
    resultCount: 1,
    reagents: [
      { itemId: 'thorium_ore', count: 4 },
      { itemId: 'mithril_mining_pick', count: 1 },
    ],
    skillReq: 75,
    trivialAt: 125,
    itemLevelBudget: 20,
  },
  {
    id: 'recipe_arcanite_mining_pick',
    professionId: 'engineering',
    resultItemId: 'arcanite_mining_pick',
    resultCount: 1,
    reagents: [
      { itemId: 'arcanite_bar', count: 2 },
      { itemId: 'thorium_mining_pick', count: 1 },
    ],
    skillReq: 150,
    trivialAt: 200,
    itemLevelBudget: 30,
  },
  {
    id: 'recipe_ashwood_axe',
    professionId: 'engineering',
    resultItemId: 'ashwood_axe',
    resultCount: 1,
    reagents: [
      { itemId: 'ashwood_log', count: 4 },
      { itemId: 'ironbark_axe', count: 1 },
    ],
    skillReq: 75,
    trivialAt: 125,
    itemLevelBudget: 20,
  },
  {
    id: 'recipe_elderwood_axe',
    professionId: 'engineering',
    resultItemId: 'elderwood_axe',
    resultCount: 1,
    reagents: [
      { itemId: 'elderwood_log', count: 2 },
      { itemId: 'ashwood_axe', count: 1 },
    ],
    skillReq: 150,
    trivialAt: 200,
    itemLevelBudget: 30,
  },
  {
    id: 'recipe_goldleaf_sickle',
    professionId: 'engineering',
    resultItemId: 'goldleaf_sickle',
    resultCount: 1,
    reagents: [
      { itemId: 'goldleaf_herb', count: 4 },
      { itemId: 'silverleaf_sickle', count: 1 },
    ],
    skillReq: 75,
    trivialAt: 125,
    itemLevelBudget: 20,
  },
  {
    id: 'recipe_sunpetal_sickle',
    professionId: 'engineering',
    resultItemId: 'sunpetal_sickle',
    resultCount: 1,
    reagents: [
      { itemId: 'sunpetal_herb', count: 2 },
      { itemId: 'goldleaf_sickle', count: 1 },
    ],
    skillReq: 150,
    trivialAt: 200,
    itemLevelBudget: 30,
  },
];

const ALL_RECIPES: ProfessionRecipeRecord[] = [...COMMON_RECIPES, ...TOOL_RECIPES];

export function recipeById(recipeId: string): ProfessionRecipeRecord | undefined {
  return ALL_RECIPES.find((r) => r.id === recipeId);
export function recipeById(recipeId: string): ProfessionRecipeRecord | undefined {
  return COMMON_RECIPES.find((r) => r.id === recipeId);
}
