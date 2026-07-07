import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Source-level guards for the bags painter. The pure click/tooltip/grid decisions are
// unit-tested in bags_view.test.ts; here we pin the no-magic-values
// contract (no raw hex; the unranked-quality fallback is a token) plus the two
// load-bearing behaviors: reusing bag_filter via buildBagGrid (not re-deriving the
// filter) and preserving the .bag-grid scroll offset across a rebuild.
const painter = readFileSync(new URL('../src/ui/bags_window.ts', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../src/ui/hud.ts', import.meta.url), 'utf8');

describe('bags_window: no magic values', () => {
  it('carries no literal hex color in TS (quality color comes from QUALITY_COLOR + a token)', () => {
    const hex = painter.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex, `hex colors must move to tokens: ${hex.join(', ')}`).toEqual([]);
  });

  it('uses the --color-quality-default token for the unranked-quality fallback', () => {
    expect(painter).toContain('var(--color-quality-default)');
  });

  it('defines --color-quality-default in the design-token sheet', () => {
    expect(tokens).toContain('--color-quality-default:');
  });

  it('uses no em or en dashes (ASCII separators only)', () => {
    expect(painter.includes('—'), 'em dash found').toBe(false);
    expect(painter.includes('–'), 'en dash found').toBe(false);
  });
});

describe('bags_window: load-bearing behaviors preserved', () => {
  it('reuses bag_filter via buildBagGrid (does not re-derive the filter)', () => {
    expect(painter).toContain('buildBagGrid(');
    // the filter/sort stays in bag_filter.ts; the painter must not call it directly
    expect(painter).not.toContain('applyBagFilter(');
  });

  it('captures and reapplies the .bag-grid scroll offset across a rebuild', () => {
    expect(painter).toContain(".bag-grid')?.scrollTop");
    expect(painter).toContain('grid.scrollTop = prevScrollTop');
  });

  it('prompt Escape stops propagation so the global escape does not also close the window', () => {
    // Without stopPropagation the keypress bubbles to the input layer's window
    // keydown, whose escape action runs closeAll: one Escape on a prompt BUTTON
    // (not tag-exempt like inputs) would dismiss the prompt AND close the bags.
    expect(painter).toMatch(/ke\.preventDefault\(\);\s*ke\.stopPropagation\(\);/);
  });
});

describe('bags_window: bank-deposit mode wiring', () => {
  it('reads the bank-open mode fresh each click through the injected dep', () => {
    // The mode flag is HUD state; the painter must read it via the dep each click,
    // never cache it, mirroring vendorOpen / isMailAttach.
    expect(painter).toContain('isBankOpen(): boolean;');
    expect(painter).toContain('bankDeposit: this.deps.isBankOpen(),');
  });

  it('hud wires isBankOpen to the live bank-window open state', () => {
    expect(hud).toContain('isBankOpen: () => this.bankWindow.isOpen,');
  });

  it('resolves the deposit target by reference index, not itemId (the index command)', () => {
    // The clicked stack maps to its inventory INDEX via the pure resolver, and the
    // whole-stack deposit passes that index (omitted count = whole stack). A stale
    // click (index < 0) is a no-op.
    expect(painter).toContain('const index = bagStackIndex(this.deps.world().inventory, s);');
    expect(painter).toContain('if (index < 0) break;');
    expect(painter).toContain('this.deps.world().bankDeposit(index);');
  });

  it('shift-clicks a splittable stack into the partial prompt, else deposits whole', () => {
    expect(painter).toContain('if (ev.shiftKey && bankDepositOpensPrompt(s)) {');
    expect(painter).toContain(
      'this.showDepositQuantityPrompt(index, s, Math.max(1, Math.floor(s.count)));',
    );
  });

  it('blocks a quest item with the sim deny wording and dispatches nothing', () => {
    // Pin the case body: it shows the established sim deny key through the shared
    // showError pipe and RETURNS, so no bankDeposit command is sent for a quest item.
    expect(painter).toMatch(
      /case 'bankDepositBlockedQuest':[\s\S]*?showError\(tSim\('error\.bankQuestItem'\)\);\s*return;/,
    );
  });

  it('the deposit prompt re-resolves the live slot at submit and refuses on a mismatch', () => {
    // The bags can repaint under the open prompt; submit must re-read inventory[index],
    // refuse (null) rather than deposit the wrong item, and clamp otherwise.
    expect(painter).toContain('const live = this.deps.world().inventory[index];');
    expect(painter).toContain(
      'const count = resolveDepositSubmit(live, captured, Number(input.value) || 0, maxCount);',
    );
    expect(painter).toMatch(/if \(count === null\) \{\s*dismiss\(\);/);
    expect(painter).toContain('this.deps.world().bankDeposit(index, count);');
  });

  it('registers the deposit prompt class so close() tears it down (no orphaned modal)', () => {
    expect(painter).toContain('.bank-deposit-prompt');
    expect(painter).toContain(
      "'.discard-item-prompt, .sell-quantity-prompt, .bank-deposit-prompt'",
    );
  });

  it('advertises the shift-click partial deposit on splittable stacks (withdraw twin)', () => {
    // The tooltip shows depositPartialHint ONLY on the deposit-hint arm (never on a
    // blocked quest item) and only for a splittable stack; without this line the
    // catalog key would be dead and the affordance undiscoverable.
    expect(painter).toContain("key === 'hudChrome.bank.depositHint' && bankDepositOpensPrompt(s)");
    expect(painter).toContain("t('hudChrome.bank.depositPartialHint')");
    expect(painter).toContain('+ extra + partial + link');
  });
});

describe('bags_window: Phase 7 touch peek + bank-cluster close', () => {
  it('the bags x-btn closes the whole bank cluster on touch (mirrors the vendor close)', () => {
    // On mobile the bank hides its own x-btn under the pairing, so the bags x-btn is
    // the cluster's single close control: it must close the bank companion too, never
    // leaving a half-screen orphan (the family behavior, cloned from closeVendor).
    expect(painter).toContain('closeBank(): void;');
    expect(painter).toMatch(
      /if \(this\.deps\.isBankOpen\(\)\) \{\s*this\.deps\.closeBank\(\);\s*return;\s*\}/,
    );
    // Guarded behind the mobile-touch gate (desktop keeps the bank's own x-btn).
    expect(painter).toMatch(
      /if \(document\.body\.classList\.contains\('mobile-touch'\)\) \{[\s\S]{0,200}?this\.deps\.closeBank\(\)/,
    );
    expect(hud).toContain('closeBank: () => this.closeBank(),');
  });

  it('the managed (Esc) close of bags closes the bank cluster on touch too', () => {
    // Mirrors the vendor arm one line above it in closeManagedWindow: on touch the
    // cluster is one unit and the bank's own x-btn is hidden, so peeling bags off
    // with Esc must not leave a half-width orphan bank.
    expect(hud).toMatch(
      /case 'bags':[\s\S]{0,700}?else if \(this\.bankWindow\.isOpen && document\.body\.classList\.contains\('mobile-touch'\)\)\s*this\.closeBank\(\);/,
    );
  });

  it('a bags close that leaves the bank open undocks the pairing on touch (standalone full-screen)', () => {
    // The tray/minimap bags toggle hides bags WITHOUT closing the bank; dropping
    // body.bank-open lets the mobile standalone full-screen rule take over (and the
    // bank x-btn reappear). close() must fire the hook on every teardown, the hud
    // must gate the undock on mobile + bank-open, and toggleBags must re-dock on
    // re-open, or the pairing never comes back.
    expect(painter).toContain('onClosed(): void;');
    expect(painter).toMatch(
      /this\.deps\.restoreFocus\(this\.openerFocus\);\s*this\.openerFocus = null;\s*this\.deps\.onClosed\(\);/,
    );
    expect(hud).toContain('onClosed: () => this.onBagsClosed(),');
    expect(hud).toMatch(
      /private onBagsClosed\(\): void \{\s*if \(document\.body\.classList\.contains\('mobile-touch'\) && this\.bankWindow\.isOpen\) \{\s*document\.body\.classList\.remove\('bank-open'\);/,
    );
    expect(hud).toMatch(
      /this\.bagsWindow\.noteOpener\(\);[\s\S]{0,400}?if \(this\.bankWindow\.isOpen\) document\.body\.classList\.add\('bank-open'\);/,
    );
  });

});
