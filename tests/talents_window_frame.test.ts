// @vitest-environment jsdom
//
// Behavioral guards for the talents window's AAA frame adoption (the pure tree /
// point-economy decisions are unit-tested in talents_view.test.ts; the
// source-level token/dash pins live in talents_window.test.ts). These render the
// real DOM through the shared window-frame builder and assert: the frame chrome
// is stamped on an INNER mount (the shared #talents-window root stays pristine so
// its clamp/resize/mobile-fit rules keep matching), the class/spec tab rail + tree
// + staged-edit build footer all render in the body, and the sacred staged-edit
// semantics survive: apply commits through deps.saveLoadout, revert-on-close
// discards the staged buffer without committing, and a loadout switch re-seeds the
// stage. The titlebar is a Hud drag handle (never the close), and the close routes
// through the frame to close().

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cloneAllocation,
  emptyAllocation,
  type SavedLoadout,
  type TalentAllocation,
} from '../src/sim/content/talents';
import type { PlayerClass } from '../src/sim/types';
import { TalentsWindow, type TalentsWindowDeps } from '../src/ui/talents_window';
import { isWindowDragHandle } from '../src/ui/window_drag_handle';

// Talent node/choice icons resolve procedural icons through a 2D canvas, which
// jsdom lacks; stub the icon module so the tree can paint without a real canvas.
vi.mock('../src/ui/talent_icons', () => ({
  talentNodeIconDataUrl: () => 'data:image/png;base64,stub',
  talentChoiceIconDataUrl: () => 'data:image/png;base64,stub',
}));

interface DepOverrides {
  cls?: PlayerClass;
  total?: number;
  activeLoadout?: number;
  loadouts?: SavedLoadout[];
  saveLoadout?: TalentsWindowDeps['saveLoadout'];
  switchLoadout?: TalentsWindowDeps['switchLoadout'];
  applyLoadoutBar?: TalentsWindowDeps['applyLoadoutBar'];
  captureDropdown?: (onChange: (v: string) => void) => void;
}

function talentsEl(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'talents-window';
  el.className = 'window panel';
  document.body.appendChild(el);
  return el;
}

function makeDeps(
  el: HTMLElement,
  stageRef: { current: TalentAllocation | null },
  o: DepOverrides = {},
): TalentsWindowDeps {
  return {
    // PainterHostPresentation (only attachTooltip is exercised by this window).
    itemIcon: () => '',
    moneyHtml: () => '',
    itemTooltip: () => '',
    attachTooltip: () => {},
    root: () => el,
    hideTooltip: () => {},
    captureFocus: () => null,
    restoreFocus: () => {},
    getStage: () => stageRef.current,
    setStage: (s) => {
      stageRef.current = s;
    },
    playerClass: () => o.cls ?? 'warrior',
    totalPoints: () => o.total ?? 11,
    currentAllocation: () => emptyAllocation(),
    activeLoadout: () => o.activeLoadout ?? -1,
    loadouts: () => o.loadouts ?? [],
    currentBar: () => [],
    saveLoadout: o.saveLoadout ?? (() => {}),
    switchLoadout: o.switchLoadout ?? (() => {}),
    deleteLoadout: () => {},
    applyLoadoutBar: o.applyLoadoutBar ?? (() => {}),
    buildDropdown: (_options, _current, onChange) => {
      o.captureDropdown?.(onChange);
      const d = document.createElement('div');
      d.className = 'tal-loadslot-dd';
      return d;
    },
    inputDialog: () => {},
    confirmDialog: () => {},
    showError: () => {},
  };
}

function openWindow(
  el: HTMLElement,
  o: DepOverrides = {},
): {
  win: TalentsWindow;
  stageRef: { current: TalentAllocation | null };
} {
  const stageRef: { current: TalentAllocation | null } = { current: null };
  const win = new TalentsWindow(makeDeps(el, stageRef, o));
  win.open();
  return { win, stageRef };
}

afterEach(() => {
  document.body.classList.remove('mobile-touch');
  document.body.innerHTML = '';
});

describe('TalentsWindow: frame adoption', () => {
  it('stamps the window-frame chrome on an INNER mount with titlebar, body, close, and NO footer', () => {
    const el = talentsEl();
    openWindow(el);
    expect(el.classList.contains('window-frame')).toBe(false);
    expect(el.hasAttribute('role')).toBe(false);
    const frame = el.querySelector<HTMLElement>(':scope > .window-frame');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('role')).toBe('dialog');
    expect(frame?.getAttribute('aria-labelledby')).toBe('talents-window-title');
    expect(frame?.querySelector('.window-titlebar')).not.toBeNull();
    expect(frame?.querySelector('.window-body')).not.toBeNull();
    expect(frame?.querySelector('[data-window-close]')).not.toBeNull();
    // The staged-edit build actions stay in the body, so the frame has no footer.
    expect(frame?.querySelector('.window-footer')).toBeNull();
  });

  it('titles the frame "Talents" and leads the body with the class-name subtitle', () => {
    const el = talentsEl();
    openWindow(el);
    expect(el.querySelector('.window-title')?.textContent).toBe('Talents');
    const body = el.querySelector<HTMLElement>('.window-body') as HTMLElement;
    expect(body.querySelector('.tal-classname')?.textContent).toBe('Warrior');
  });

  it('keeps the shared root a pristine .window.panel (no builder class / role / aria)', () => {
    const el = talentsEl();
    openWindow(el);
    expect(el.className).toBe('window panel');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('renders the class/spec tab rail, the tree, and the build footer inside the body', () => {
    const el = talentsEl();
    openWindow(el);
    const body = el.querySelector<HTMLElement>('.window-body') as HTMLElement;
    expect(body.querySelectorAll('.tal-tabs .tal-tab').length).toBe(2);
    expect(body.querySelector('#tal-body .tal-tree')).not.toBeNull();
    expect(body.querySelectorAll('#tal-body .tal-node').length).toBeGreaterThan(0);
    expect(body.querySelector('.tal-foot')).not.toBeNull();
    expect(body.querySelector('[data-act="save"]')).not.toBeNull();
  });

  it('reuses the frame on a re-render instead of rebuilding it cold', () => {
    const el = talentsEl();
    const { win } = openWindow(el);
    const firstBody = el.querySelector('.window-body');
    win.render();
    expect(el.querySelector('.window-body')).toBe(firstBody);
    expect(el.querySelectorAll('.window-titlebar').length).toBe(1);
  });
});

describe('TalentsWindow: move / resize / fit parity', () => {
  it('makes the frame titlebar a Hud drag handle, but never the close button', () => {
    const el = talentsEl();
    openWindow(el);
    const titlebar = el.querySelector<HTMLElement>('.window-titlebar') as HTMLElement;
    const closeBtn = el.querySelector<HTMLElement>('[data-window-close]') as HTMLElement;
    expect(isWindowDragHandle(titlebar, el)).toBe(true);
    expect(isWindowDragHandle(closeBtn, el)).toBe(false);
  });

  it('refuses the titlebar drag on the touch HUD, and recognizes it again without it', () => {
    const el = talentsEl();
    openWindow(el);
    const titlebar = el.querySelector<HTMLElement>('.window-titlebar') as HTMLElement;
    document.body.classList.add('mobile-touch');
    expect(isWindowDragHandle(titlebar, el)).toBe(false);
    document.body.classList.remove('mobile-touch');
    expect(isWindowDragHandle(titlebar, el)).toBe(true);
  });
});

describe('TalentsWindow: staged-edit semantics (sacred)', () => {
  it('spends a point into the staged buffer when an available node is clicked, never the live build', () => {
    const el = talentsEl();
    const { stageRef } = openWindow(el);
    // An available (avail) non-choice node spends a rank directly on click; a
    // choice (octagon) node opens a flyout instead, so exclude it here.
    const node = el.querySelector<HTMLElement>('#tal-body .tal-node.avail:not(.octagon)');
    expect(node, 'expected at least one spendable node in the warrior class tree').not.toBeNull();
    (node as HTMLElement).click();
    // The click mutated the staged buffer in place (points now spent), NOT the
    // server-authoritative build (the commit path is save/switch/delete only).
    const spent = Object.keys(stageRef.current?.ranks ?? {}).length;
    expect(spent).toBeGreaterThan(0);
  });

  it('APPLY: Save current commits the staged build through deps.saveLoadout', () => {
    const el = talentsEl();
    const saveLoadout = vi.fn();
    const loadouts: SavedLoadout[] = [{ name: 'PvP', alloc: emptyAllocation(), bar: [] }];
    openWindow(el, { saveLoadout, loadouts, activeLoadout: 0 });
    el.querySelector<HTMLButtonElement>('[data-act="save"]')?.click();
    // An active loadout saves in place under its own name (no prompt).
    expect(saveLoadout).toHaveBeenCalledTimes(1);
    expect(saveLoadout.mock.calls[0][0]).toBe('PvP');
  });

  it('REVERT: closing discards the staged buffer without committing to the live build', () => {
    const el = talentsEl();
    const saveLoadout = vi.fn();
    const { win, stageRef } = openWindow(el, { saveLoadout });
    expect(stageRef.current).not.toBeNull(); // seeded on open
    win.close();
    // The staged edits are dropped (buffer nulled), and nothing was committed.
    expect(stageRef.current).toBeNull();
    expect(saveLoadout).not.toHaveBeenCalled();
    expect(el.style.display).toBe('none');
  });

  it('LOADOUT SWITCH: selecting a saved build switches it and re-seeds the stage', () => {
    const el = talentsEl();
    const switchLoadout = vi.fn();
    const applyLoadoutBar = vi.fn();
    const alloc = cloneAllocation(emptyAllocation());
    const loadouts: SavedLoadout[] = [{ name: 'Fury', alloc, bar: ['a', 'b'] }];
    let onChange: ((v: string) => void) | null = null;
    const { stageRef } = openWindow(el, {
      switchLoadout,
      applyLoadoutBar,
      loadouts,
      activeLoadout: -1,
      captureDropdown: (cb) => {
        onChange = cb;
      },
    });
    expect(onChange).not.toBeNull();
    (onChange as unknown as (v: string) => void)('0');
    expect(switchLoadout).toHaveBeenCalledWith(0);
    expect(applyLoadoutBar).toHaveBeenCalledWith(['a', 'b']);
    // The stage is re-seeded from a CLONE of the switched-to build (not the same ref).
    expect(stageRef.current).not.toBe(alloc);
    expect(stageRef.current).toEqual(alloc);
  });
});

describe('TalentsWindow: close routing', () => {
  it('routes the frame close control through close(): hides the root and restores focus', () => {
    const el = talentsEl();
    const stageRef: { current: TalentAllocation | null } = { current: null };
    const restoreFocus = vi.fn();
    const deps = makeDeps(el, stageRef);
    deps.restoreFocus = restoreFocus;
    const win = new TalentsWindow(deps);
    win.open();
    el.querySelector<HTMLElement>('[data-window-close]')?.click();
    expect(el.style.display).toBe('none');
    expect(restoreFocus).toHaveBeenCalledTimes(1);
  });
});
