// WCAG-chrome + no-magic source guard for the arena window DOM painter.
//
// The painter's DOM/network methods need a document + fetch, so they are not
// exercised in this Node suite; the pure decisions it renders are covered by
// tests/arena_window_view.test.ts. This guard pins the a11y-bearing markup
// (focusable controls + aria labels + focus-return) and the decision-12 contract
// for a DOM painter (no literal colors in TS; cadences are named constants).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('../src/ui/arena_window.ts', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const hud = readFileSync(new URL('../src/ui/hud.ts', import.meta.url), 'utf8');

describe('arena_window: WCAG chrome (focusable controls + focus-return)', () => {
  it('drives the panel from the pure view core', () => {
    expect(code).toContain('buildArenaView(');
  });

  it('gives the close control a real button with an aria-label', () => {
    expect(code).toContain('class="x-btn" data-close aria-label=');
    expect(code).toContain("t('hud.arena.close')");
  });

  it('renders bracket tabs as real buttons with aria-pressed state', () => {
    expect(code).toContain('class="arena-bracket');
    expect(code).toContain('data-bracket=');
    expect(code).toContain('aria-pressed=');
  });

  it('routes every close path through close() so focus returns to the opener', () => {
    // The X button (both offline + live) closes via the painter, not a raw hide.
    expect(code).toContain("data-close]')?.addEventListener('click', () => this.close())");
    // close() captures + restores the opener focus (WCAG 2.2 AA focus-return).
    expect(code).toContain('this.deps.restoreFocus(this.openerFocus)');
    expect(code).toContain('this.openerFocus = this.deps.captureFocus()');
  });

  it('keeps the offline / not-yet-synced unavailable note', () => {
    expect(code).toContain("t('hud.arena.offlineNote')");
  });
});

describe('arena_window: no magic values (decision 12, DOM painter)', () => {
  it('carries no literal hex or rgb color in TS (colors live in the stylesheet)', () => {
    const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const rgb = code.match(/\brgba?\s*\(/g) ?? [];
    expect(hex, `hex colors: ${hex.join(', ')}`).toEqual([]);
    expect(rgb, `rgb colors: ${rgb.join(', ')}`).toEqual([]);
  });

  it('names the leaderboard refetch cadence instead of an inline literal', () => {
    expect(code).toContain('const LEADERBOARD_REFETCH_MS =');
    expect(code).toContain('< LEADERBOARD_REFETCH_MS');
    // The raw throttle interval is not inlined at the call site.
    expect(code).not.toContain('< 15000');
  });
});

describe('arena_window: mediumHud redraw call site', () => {
  it("still redraws the open arena window from hud.update()'s mediumHud band", () => {
    // Symmetric to the map painter's cadence guard: pin the hud.ts call site so a
    // refactor cannot silently stop the open arena window from refreshing (queue
    // size, ladder, match state) while it is displayed.
    expect(hud).toContain(
      "if ($('#arena-window').style.display === 'block') this.arenaWindow.render();",
    );
  });
});
