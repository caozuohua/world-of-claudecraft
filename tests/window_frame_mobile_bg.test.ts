// Mobile window-frame background guards.
//
// Live bug (PR #1736 feedback round 3): every resizable framed window was
// completely see-through on touch. The desktop grip rule paints TWO background
// layers on `.window.window-resizable > .window-frame` (the 12px corner grip +
// the panel gradient) with per-layer background-size/position/repeat lists
// (12px 12px / bottom-right / no-repeat for the grip layer). The mobile
// override then swapped in a SINGLE-layer background-image (just the gradient)
// without resetting those lists, so CSS applied the grip layer's first values
// to the gradient: the whole panel painted as one unrepeated 12x12px tile
// parked at bottom-right, and the 3D world showed through everything else.
//
// These are source-scan pins on the two rules that carry the hazard plus the
// touch never-see-through floor; they parse the shipped CSS, not a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const components = readFileSync('src/styles/components.css', 'utf8');
const hudMobile = readFileSync('src/styles/hud.mobile.css', 'utf8');

/** Extract the declaration block of the rule whose selector list contains EXACTLY this selector. */
function ruleBlock(css: string, selector: string): string {
  // Strip comments first (a comment between rules would otherwise leak into the
  // next rule's selector text), then walk flat rules; selectors are compared
  // whole (comma-split, whitespace-normalized), never by substring, so
  // `body.mobile-touch .window-frame` cannot match `... .window-frame .btn`.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const want = selector.replace(/\s+/g, ' ').trim();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of clean.matchAll(re)) {
    const sels = m[1].split(',').map((s) => s.replace(/\s+/g, ' ').trim());
    if (sels.includes(want)) return m[2];
  }
  return '';
}

describe('mobile window-frame background layer hygiene', () => {
  const pinned = [
    {
      name: 'shared grip override',
      selector: 'body.mobile-touch .window.window-resizable > .window-frame',
    },
    {
      name: 'heroic-shop grip override',
      selector: 'body.mobile-touch .window.window-resizable > .heroic-shop > .window-frame',
    },
  ];

  for (const rule of pinned) {
    it(`${rule.name} resets the grip layer geometry it un-layers`, () => {
      const block = ruleBlock(components, rule.selector);
      expect(block, `rule not found: ${rule.selector}`).not.toBe('');
      // The override replaces the two-layer image list with one layer, so it must
      // also reset the per-layer lists the desktop grip rule set, or the single
      // gradient inherits the grip's 12px no-repeat bottom-right geometry and the
      // panel paints as a 12x12 dot (the shipped bug). Accept either the explicit
      // longhand resets or a `background:` shorthand (which resets all of them).
      const usesShorthand = /(^|;)\s*background\s*:/.test(block);
      if (!usesShorthand) {
        expect(block, 'background-size reset missing').toMatch(/background-size\s*:\s*auto/);
        expect(block, 'background-position reset missing').toMatch(/background-position\s*:\s*0(px)?\s+0(px)?/);
        expect(block, 'background-repeat reset missing').toMatch(/background-repeat\s*:\s*repeat/);
      }
    });
  }

  it('touch keeps the solid never-see-through floor under every framed window', () => {
    // The tokens L2 doctrine: a modal surface must never composite the 3D world
    // through it. On touch every window is a full/near-fullscreen sheet over the
    // live world, so the frame rides the solid L2 base under its L1 gradient
    // (generalizing the options-menu fix that predated this bug's diagnosis).
    const block = ruleBlock(hudMobile, 'body.mobile-touch .window-frame');
    expect(block, 'universal mobile .window-frame rule missing').not.toBe('');
    expect(block).toMatch(/background-color\s*:\s*var\(--color-panel-l2-base\)/);
  });
});
