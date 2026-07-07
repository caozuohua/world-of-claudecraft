// Pure view-core for the desktop Bank window (#bank), the per-character deposit
// box read off the IWorld bank mirror. DOM/Three/i18n-free: it maps the
// proximity-gated BankInfo snapshot (null away from a banker) to a flat render
// model the thin painter (bank_window.ts) draws, and decides the slot click
// action (a whole withdraw vs the shift split-stack prompt). Registered in
// UI_PURE_CORES; unit-tested against both Sim- and ClientWorld-shaped inputs in
// tests/bank_view.test.ts. Mirrors the bags_view / mailbox_view pure-core split.

import { BANK_EXPANSION_SLOTS, moveBetweenContainers } from '../sim/bank';
import { cloneInvSlot, type InvSlot } from '../sim/types';
import type { BankInfo } from '../world_api';
import { type ItemLookup, matchesCategory } from './bag_filter';
import { bagQualityKey } from './bags_view';

/** The item facts the bank grid needs from the item table: just the quality, so
 *  the painter can tint the slot. A miss (unknown id) is tolerated as 'common'. */
export type BankItemLookup = (itemId: string) => { quality?: string } | undefined;

/** One occupied bank cell. `slotIndex` is the index into BankInfo.slots and is
 *  the exact wire argument for bankDeposit/bankWithdraw (order is preserved, no
 *  sort/filter this phase). */
export interface BankSlotModel {
  slotIndex: number;
  itemId: string;
  count: number;
  showCount: boolean; // count > 1 (a lone item hides its "1")
  qualityKey: string; // item quality ?? 'common' (bagQualityKey semantics)
}

/** The header counter: occupied slots over the total budget, plus the two budget
 *  contributions the buy panel and tooltips surface. */
export interface BankCapacityModel {
  used: number;
  total: number;
  purchasedSlots: number;
  bonusSlots: number;
}

/** The expand-slots panel: the next block's copper price (null once maxed), the
 *  block size, and the maxed flag the painter disables the button on. */
export interface BankBuySlotsModel {
  nextCost: number | null;
  blockSlots: number;
  maxed: boolean;
}

/** The whole window model: 'away' when no banker is in reach (bankInfo null),
 *  else the populated grid + capacity + buy panel. */
export type BankViewModel =
  | { kind: 'away' }
  | {
      kind: 'bank';
      capacity: BankCapacityModel;
      slots: BankSlotModel[];
      // Free cells to paint after the items. Over-capacity states (a legacy/tampered
      // save with used > total) clamp to 0, never a negative pad.
      emptyCells: number;
      empty: boolean; // no occupied slots
      buy: BankBuySlotsModel;
    };

/** Map the proximity-gated bank snapshot to the render model. `info` is null away
 *  from a banker (both worlds), which yields the 'away' state. Slot order and
 *  indices are preserved verbatim (search/sort is a later phase). */
export function buildBankView(info: BankInfo | null, lookup: BankItemLookup): BankViewModel {
  if (!info) return { kind: 'away' };
  const used = info.slots.length;
  const total = info.capacity;
  const slots: BankSlotModel[] = info.slots.map((slot, slotIndex) => ({
    slotIndex,
    itemId: slot.itemId,
    count: slot.count,
    showCount: slot.count > 1,
    qualityKey: bagQualityKey(lookup(slot.itemId) ?? {}),
  }));
  return {
    kind: 'bank',
    capacity: {
      used,
      total,
      purchasedSlots: info.purchasedSlots,
      bonusSlots: info.bonusSlots,
    },
    slots,
    emptyCells: Math.max(0, total - used),
    empty: slots.length === 0,
    buy: {
      nextCost: info.nextExpansionCost,
      blockSlots: BANK_EXPANSION_SLOTS,
      maxed: info.nextExpansionCost === null,
    },
  };
}

/** What a click on a bank slot does: a whole-stack withdraw, the split-stack
 *  prompt (shift on a multi-count fungible), or nothing (empty cell). The core
 *  never touches copper affordability: that is server-authoritative and the sim
 *  refuses with its own line. */
export type BankSlotAction =
  | { kind: 'withdraw'; slotIndex: number }
  | { kind: 'withdrawPartial'; slotIndex: number; max: number }
  | { kind: 'none' };

/** Decide the slot click. A shift-click on a multi-count stack opens the partial
 *  prompt, EXCEPT on an instanced slot: a per-instance payload (#1165) moves whole
 *  regardless of count (the sim never splits it), so shift falls through to a plain
 *  withdraw there. An undefined slot (empty cell) is a no-op. */
export function bankSlotAction(
  slot: InvSlot | undefined,
  slotIndex: number,
  shift: boolean,
): BankSlotAction {
  if (!slot) return { kind: 'none' };
  if (shift && slot.count > 1 && !slot.instance) {
    return { kind: 'withdrawPartial', slotIndex, max: slot.count };
  }
  return { kind: 'withdraw', slotIndex };
}

/** One planned deposit: the ORIGINAL inventory slot index plus the whole-stack count
 *  to send. `count` equals the source stack size (a whole-stack deposit); bankDeposit
 *  (slotIndex, count) with count === the live stack splices it out, exactly like an
 *  undefined count would. */
export interface DepositAllSend {
  slot: number;
  count: number;
}

/** The deposit-all-materials plan: the ordered whole-stack sends, how many stacks
 *  they move (=== sends.length), and whether the bank ran out of room for a material
 *  that did not fit (drives the "bank filled" summary variant). */
export interface DepositAllPlan {
  sends: DepositAllSend[];
  stacks: number;
  full: boolean;
}

/** Plan a "deposit all materials" run WITHOUT mutating the live world: it simulates
 *  each candidate deposit on deep clones using the sim's OWN moveBetweenContainers, so
 *  capacity + stacking + instanced-slot behavior is byte-identical to what the server
 *  resolves, then returns the ordered sends the caller replays via bankDeposit.
 *
 *  Selection: every fungible OR instanced material stack (matchesCategory 'material' =
 *  junk/tool), NEVER a quest item (excluded by matchesCategory and re-guarded here).
 *  Each send is a WHOLE-stack deposit (the sim's all-or-nothing rule): a stack that
 *  does not FULLY fit is skipped, not partially deposited, and sets `full`. Partial
 *  deposits would have to re-derive the sim's countFit stacking math, which this must
 *  never do; the sim's bankDeposit already refuses a whole-stack move that does not
 *  fully fit (moveBetweenContainers' countFit gate), so whole-stack-or-skip matches it
 *  exactly. Iteration is DESCENDING by index so each successful move's source splice
 *  only shifts indices ABOVE the one just removed (already processed): every recorded
 *  slot index stays valid when the caller replays the sends IN THIS ORDER against the
 *  live world.
 *
 *  ONLINE latency: the whole plan is computed against ONE snapshot (the inventory +
 *  bank at click time); the caller sends every command without re-reading state
 *  mid-run, because the ClientWorld mirror lags the authoritative world by ~1 tick. */
export function planDepositAllMaterials(
  inventory: readonly InvSlot[],
  bankSlots: readonly InvSlot[],
  capacity: number,
  lookup: ItemLookup,
): DepositAllPlan {
  const invClone = inventory.map(cloneInvSlot);
  const bankClone = bankSlots.map(cloneInvSlot);
  const sends: DepositAllSend[] = [];
  let full = false;
  for (let i = invClone.length - 1; i >= 0; i--) {
    const slot = invClone[i];
    const item = lookup(slot.itemId);
    if (!item) continue; // unknown id: not a known material, leave it in the bags
    if (item.kind === 'quest') continue; // never bank quest items (matchesCategory also excludes them)
    if (!matchesCategory(item, 'material')) continue;
    const count = slot.count;
    const result = moveBetweenContainers(invClone, i, count, bankClone, capacity);
    if (result.refusal === 'no_fit') {
      full = true;
      continue; // the bank could not take this whole stack; a smaller one may still fit
    }
    if (result.refusal) continue; // 'invalid': malformed slot (should not happen); skip
    sends.push({ slot: i, count });
  }
  return { sends, stacks: sends.length, full };
}

/** The three deposit-all summary lines, as t() keys so the painter stays a thin
 *  consumer and the arm CHOICE is unit-pinned here rather than buried in DOM code. */
export type DepositAllSummaryKey =
  | 'hudChrome.bank.depositAllNone'
  | 'hudChrome.bank.depositAllFull'
  | 'hudChrome.bank.depositAllDone';

/** Which transient summary a finished deposit-all plan earns. Exactly one of three
 *  arms: no stack moved (materials existed, the button gates on
 *  hasDepositableMaterials, but none fit) -> depositAllNone; some moved but at least
 *  one did not fit -> depositAllFull; everything fit -> depositAllDone. */
export function depositAllSummaryKey(
  plan: Pick<DepositAllPlan, 'stacks' | 'full'>,
): DepositAllSummaryKey {
  if (plan.stacks === 0) return 'hudChrome.bank.depositAllNone';
  if (plan.full) return 'hudChrome.bank.depositAllFull';
  return 'hudChrome.bank.depositAllDone';
}

/** True when the carried inventory holds at least one depositable material stack (a
 *  junk/tool item, never a quest item, which matchesCategory('material') excludes):
 *  the deposit-all button's enabled state. */
export function hasDepositableMaterials(
  inventory: readonly InvSlot[],
  lookup: ItemLookup,
): boolean {
  return inventory.some((s) => {
    const item = lookup(s.itemId);
    return !!item && matchesCategory(item, 'material');
  });
}
