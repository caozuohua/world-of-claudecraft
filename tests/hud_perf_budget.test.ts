// THE STANDING per-frame perf-budget floor (frontend-modernization v0.16.0, P17a).
//
// Every per-frame phase P10a-P14b proved its write-elision + allocation budget ONCE
// at its own perf gate; those gates were one-shot. This file makes them permanent, so
// a future change that collapses the write-elision cache, reallocates a per-frame core,
// or unbounds a pool fails here instead of silently regressing. It is grounded in the
// COMMITTED P0 baseline (docs/frontend-modernization/perf-baseline-v016.md): the
// durable anchor hudHotDomSkipRate >= 0.962 is READ from that file (never defaulted to
// 0), so a missing baseline fails the budget rather than passing a hollow gate.
//
// THE ASSERTIONS ARE SPLIT BY HOST so each runs where it can actually be measured:
//
//   ARM 1 - STATIC SOURCE-SCAN (Node, runs in every `npm test`): the raw-write
//     rejection. Every hot-path painter must route ALL per-frame writes through the
//     PainterHost elided writers (setText/setDisplay/setTransform/setWidth +
//     setStyleProp/toggleClass/setAttr); no raw .style/.textContent/.classList/
//     .className/.setAttribute/.setProperty/.innerHTML beyond a DOCUMENTED build-time
//     exception (decision 5a). This is the same per-painter check the per-frame phases
//     used, consolidated so a NEW hot painter is covered the moment it is added here.
//
//   ARM 2 - FAKE-DOM RUNTIME (Node, runs in every `npm test`): the skip-rate budget and
//     the allocation budget. The repo has NO jsdom (the tiny-dependency invariant), so
//     DOM-touching wiring is exercised with a hand-rolled fake DOM in the node env, the
//     same idiom tests/focus_manager.test.ts uses. The skip-rate loop drives the
//     non-pooled per-frame painters through a steady-state update loop over a REAL
//     makeWriterFacet and asserts (a) per painter: a repeated identical frame writes
//     NOTHING (perfect elision, the Top-risk-1 collapse detector), and (b) aggregate:
//     the facet skip-rate stays >= the committed P0 floor. It runs for BOTH a Sim-shaped
//     and a ClientWorld-mirror-shaped input (decision 15): unit_frame's absorb shield is
//     offline-only, and auras_view's aura value is zeroed online, so each shape is fed.
//     The allocation proxy is the P12a reference-stability probe (tests/util/alloc_probe):
//     the action-bar and auras view cores must return a REUSED container every tick.
//
//   ARM 3 - PERF_TOUR-DELEGATED (env HUD_PERF_BUDGET_TOUR=1, runs in the perf row, NOT
//     bare `npm test`): the wall-clock + macro-pool budget. It reads a perf_tour artifact
//     (a real-browser run of scripts/perf_tour.mjs) and the same committed baseline, and
//     asserts frameP95 <= the baseline (same-machine; see the baseline file, frameP95 is
//     NOT portable, so an operator on other hardware overrides the reference with a fresh
//     re-run via HUD_PERF_BUDGET_TOUR_FRAME_BASELINE), hudHotDomSkipRate >= the floor, and
//     the P13b FCT pool stays cap-bounded under the scripted AoE burst (fctBurstBoundedNodes).
//     It is SKIPPED when the env flag is unset so bare `npm test` stays fast and portable.
//
// COVERAGE NOTE (not a silent cap): the ARM 2 skip-rate loop drives the five non-pooled
// per-frame painters (xp_bar, swing_timer, cast_bar, unit_frame, action_bar), which
// together exercise all seven elided writers. The keyed-pool painters (auras P12b, party
// P11c, fct P13b) build + reconcile real DOM nodes; their per-frame elision is proven in
// their own *_painter.test.ts steady-state tests, the auras + action_bar allocation here,
// and the FCT pool cap in ARM 3. ARM 1 still scans all eight painters (incl. the pooled
// ones) for raw writes.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CastBarState } from '../src/render/cast_bar';
import type { AbilityDef, Aura } from '../src/sim/types';
import {
  type ActionBarPaintDescriptor,
  ActionBarPainter,
  type ActionBarSlotElements,
} from '../src/ui/action_bar_painter';
import {
  type ActionBarDeps,
  type ActionBarState,
  type ActionBarWorldInput,
  createActionBarView,
} from '../src/ui/action_bar_view';
import { type AuraInput, type AurasDeps, createAurasView } from '../src/ui/auras_view';
import {
  type CastBarElements,
  type CastBarOptions,
  CastBarPainter,
  type CastBarPaintInput,
} from '../src/ui/cast_bar_painter';
import { makeWriterFacet, type PainterHostWriters } from '../src/ui/painter_host';
import type { SwingTimerState } from '../src/ui/swing_timer';
import { SwingTimerPainter } from '../src/ui/swing_timer_painter';
import { type UnitFrameDescriptor, unitFrameView } from '../src/ui/unit_frame';
import { type UnitFrameElements, UnitFramePainter } from '../src/ui/unit_frame_painter';
import type { XpBarView } from '../src/ui/xp_bar';
import { XpBarPainter } from '../src/ui/xp_bar_painter';
import { assertAllocationStable } from './util/alloc_probe';

// --------------------------------------------------------------------------
// The committed P0 baseline (read, never defaulted).
// --------------------------------------------------------------------------

const BASELINE_FILE = '../docs/frontend-modernization/perf-baseline-v016.md';
const baselineMd = readFileSync(new URL(BASELINE_FILE, import.meta.url), 'utf8');

// The DURABLE, machine-independent floor. The baseline records it as a markdown table
// row (`| **hudHotDomSkipRate** | **0.962** (...) | ... |`) and again as a prose gate
// (`assert hudHotDomSkipRate >= 0.962`); either line yields the same value. Throw if it
// is absent so a deleted / unregenerated baseline fails the budget instead of defaulting.
function readBaselineSkipRateFloor(): number {
  const line = baselineMd
    .split('\n')
    .find((l) => l.includes('hudHotDomSkipRate') && /\b0\.\d+/.test(l));
  const match = line?.match(/\b(0\.\d+)/);
  if (!match) {
    throw new Error(
      'perf-baseline-v016.md: the hudHotDomSkipRate floor is missing. The committed P0 baseline is absent or the key was removed; the skip-rate budget cannot be grounded. Regenerate + commit the P0 perf baseline before relying on this gate.',
    );
  }
  return Number(match[1]);
}

// frameP95 is SAME-MACHINE-RELATIVE only (software-WebGL ms, not portable). ARM 3 reads
// it as the reference, but an operator on other hardware overrides it with a fresh
// same-machine re-run (HUD_PERF_BUDGET_TOUR_FRAME_BASELINE).
function readBaselineFrameP95(): number {
  const line = baselineMd.split('\n').find((l) => l.includes('frameP95') && /\d+\s*ms/.test(l));
  const match = line?.match(/(\d+)\s*ms/);
  if (!match) {
    throw new Error('perf-baseline-v016.md: the frameP95 baseline (`NNN ms`) is missing.');
  }
  return Number(match[1]);
}

const SKIP_RATE_FLOOR = readBaselineSkipRateFloor();

// --------------------------------------------------------------------------
// ARM 1 - static raw-write rejection over every hot-path painter.
// --------------------------------------------------------------------------

// The raw-DOM-write vocabulary the per-frame phases reject. Every per-frame write must
// go through a facet writer, so any of these on a painter's hot path is a decision-5a
// break. Each painter pins its DOCUMENTED build-time exceptions by COUNT (the same
// allowances the per-painter tests pin): a pooled node's class is set once in its
// builder, not per frame.
const RAW_WRITE_TOKENS = [
  '.style',
  '.textContent',
  '.classList',
  '.className',
  '.setAttribute',
  '.setProperty',
  '.innerHTML',
] as const;

// Allowed counts: anything not listed must be ZERO. auras builds its pooled node + the
// .dur / .stacks children once in createNode (3 className writes); fct sets the base
// class once and aria-hidden once per pooled node, both at build.
const HOT_PAINTERS: ReadonlyArray<{ file: string; allow: Partial<Record<string, number>> }> = [
  { file: 'xp_bar_painter.ts', allow: {} },
  { file: 'swing_timer_painter.ts', allow: {} },
  { file: 'cast_bar_painter.ts', allow: {} },
  { file: 'unit_frame_painter.ts', allow: {} },
  { file: 'action_bar_painter.ts', allow: {} },
  { file: 'party_frames_painter.ts', allow: {} },
  { file: 'auras_painter.ts', allow: { '.className': 3 } },
  { file: 'fct_painter.ts', allow: { '.className': 1, '.setAttribute': 1 } },
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function countToken(code: string, token: string): number {
  // Word-boundary match like the per-painter guards, so `.style` does not match a
  // `.styleProp` member and `.setAttribute` is the method, not a substring.
  const re = new RegExp(`\\${token}\\b`, 'g');
  return (code.match(re) ?? []).length;
}

describe('hud_perf_budget ARM 1: hot painters make no raw DOM write (Node, npm test)', () => {
  for (const { file, allow } of HOT_PAINTERS) {
    it(`${file} routes every per-frame write through the elided writers`, () => {
      const src = readFileSync(new URL(`../src/ui/${file}`, import.meta.url), 'utf8');
      const code = stripComments(src);
      for (const token of RAW_WRITE_TOKENS) {
        const expected = allow[token] ?? 0;
        const actual = countToken(code, token);
        expect(
          actual,
          `${file}: ${token} appears ${actual}x, expected ${expected} (per-frame writes must go through the PainterHost facet; only a DOCUMENTED build-time exception is allowed)`,
        ).toBe(expected);
      }
    });
  }
});

// --------------------------------------------------------------------------
// ARM 2 - fake-DOM runtime: skip-rate budget + allocation budget.
// --------------------------------------------------------------------------

// A fake element supporting exactly the write surface makeWriterFacet.apply() touches.
// It is only a Map key for the elision cache + a no-throw write sink; the facet never
// READS it back (the cache stores the value it last wrote), so nothing is recorded.
function fakeEl(): HTMLElement {
  return {
    textContent: '',
    style: {
      display: '',
      width: '',
      transform: '',
      setProperty(): void {},
    },
    classList: {
      toggle(): void {},
    },
    setAttribute(): void {},
  } as unknown as HTMLElement;
}

// One real write-elision facet over fresh caches + a single write/skip counter pair, so
// every painter driven through it shares ONE aggregate skip-rate (exactly how the Hud
// builds its facet over its own caches/counters).
function countingFacet(): { facet: PainterHostWriters; counts: { writes: number; skips: number } } {
  const counts = { writes: 0, skips: 0 };
  const facet = makeWriterFacet(
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    () => {
      counts.writes++;
    },
    () => {
      counts.skips++;
    },
  );
  return { facet, counts };
}

type WorldShape = 'sim' | 'clientworld';

interface PainterHarness {
  name: string;
  drive: () => void;
}

// Build each non-pooled per-frame painter once, with fresh fake elements, plus a drive()
// closure that paints a STEADY view. `shape` selects the offline-only / online-zeroed
// fields (decision 15): the values are byte-identical across drives within a shape, so a
// correctly-eliding painter writes only on the first drive.
function buildHarnesses(shape: WorldShape, facet: PainterHostWriters): PainterHarness[] {
  const harnesses: PainterHarness[] = [];

  // xp_bar: setWidth + setStyleProp (--xp-fill on bar + frame, rested geometry) + setText + toggleClass.
  {
    const bar = fakeEl();
    const fill = fakeEl();
    const rested = fakeEl();
    const label = fakeEl();
    const playerFrame = fakeEl();
    const painter = new XpBarPainter(facet, bar, fill, rested, label, playerFrame);
    const view: XpBarView = { fillFrac: 0.5, restedFrac: 0.1, label: 'XP 1 / 2', postCap: false };
    harnesses.push({ name: 'xp_bar', drive: () => painter.paint(view) });
  }

  // swing_timer: setDisplay + setWidth + toggleClass + setText.
  {
    const painter = new SwingTimerPainter(facet, fakeEl(), fakeEl(), fakeEl());
    const state: SwingTimerState = {
      visible: true,
      frac: 0.5,
      ready: false,
      labelKind: 'seconds',
      seconds: 1.4,
      nextPeriod: 2,
      nextTimer: 1,
    };
    harnesses.push({ name: 'swing_timer', drive: () => painter.paint(state) });
  }

  // cast_bar: setDisplay + toggleClass + setWidth + setText x2 + setAttr (aria-valuenow).
  {
    const els: CastBarElements = {
      bar: fakeEl(),
      fill: fakeEl(),
      label: fakeEl(),
      timer: fakeEl(),
    };
    const opts: CastBarOptions = { resolveCastLabel: (s) => s.label };
    const painter = new CastBarPainter(facet, els, opts);
    const cast: CastBarState = {
      visible: true,
      channel: false,
      fill: 0.8,
      label: 'fireball',
      fishing: false,
    };
    const input: CastBarPaintInput = { cast, castRemaining: 0.5 };
    harnesses.push({ name: 'cast_bar', drive: () => painter.paint(input) });
  }

  // unit_frame: setText + setTransform (hp, absorb, resource) + toggleClass (overshield,
  // resource type). DECISION 15: the absorb shield is offline-only - present in the Sim
  // shape, zeroed in the ClientWorld mirror - so the painter sees both shapes.
  {
    const els: UnitFrameElements = {
      frame: fakeEl(),
      level: fakeEl(),
      hpFill: fakeEl(),
      hpText: fakeEl(),
      absorb: fakeEl(),
      resource: { container: fakeEl(), fill: fakeEl(), text: fakeEl() },
    };
    const painter = new UnitFramePainter(facet, els);
    const absorb =
      shape === 'sim'
        ? { hp: 300, maxHp: 600, auras: [{ kind: 'absorb', value: 100 } as unknown as Aura] }
        : { hp: 300, maxHp: 600, auras: [] as Aura[] };
    const desc: UnitFrameDescriptor = {
      present: true,
      hpFrac: 0.5,
      hpText: '300 / 600',
      resourceKind: 'mana',
      resFrac: 0.8,
      resText: '80 / 100',
      levelText: '60',
      name: 'Aerwynn',
      portraitKey: 'player',
      absorb,
      dead: false,
      outOfRange: false,
    };
    harnesses.push({ name: 'unit_frame', drive: () => painter.paint(unitFrameView(desc)) });
  }

  // action_bar: container many-spells toggle + per-slot writers + setAttr (aria-label).
  {
    const slot: ActionBarSlotElements = {
      btn: fakeEl(),
      label: fakeEl(),
      countEl: fakeEl(),
      keybindEl: fakeEl(),
      cdOverlay: fakeEl(),
      cdText: fakeEl(),
    };
    const descriptor: ActionBarPaintDescriptor = { container: fakeEl(), slots: [slot] };
    const painter = new ActionBarPainter(facet, descriptor, (key) => `URL(${key})`);
    const state: ActionBarState = {
      manySpells: false,
      slots: [
        {
          kind: 'ability',
          abilityId: 'x',
          itemId: null,
          iconKey: 'ability:x',
          cooldownRemaining: 0,
          cooldownTotal: 0,
          cooldownPercent: 0,
          cdText: '',
          count: '',
          usable: true,
          outOfRange: false,
          queued: false,
          ariaLabel: 'A',
          keybindLabel: 'K',
        },
      ],
    };
    harnesses.push({ name: 'action_bar', drive: () => painter.paint(state) });
  }

  return harnesses;
}

// Drive every painter once to establish, then REPEATS identical frames. A correctly
// eliding painter writes nothing on the repeats; a non-byte-identical cache key (risk 1)
// writes every frame and fails the per-painter assertion immediately. Returns the
// aggregate skip-rate so the floor can be asserted too.
const REPEATS = 64;

function runSkipRateLoop(shape: WorldShape): number {
  const { facet, counts } = countingFacet();
  for (const harness of buildHarnesses(shape, facet)) {
    harness.drive();
    const writesBefore = counts.writes;
    for (let frame = 0; frame < REPEATS; frame++) harness.drive();
    const extra = counts.writes - writesBefore;
    expect(
      extra,
      `${harness.name} (${shape}): a repeated identical frame must elide every write (got ${extra} new writes across ${REPEATS} steady frames). A non-byte-identical cache key collapses the skip-rate (Top risk 1).`,
    ).toBe(0);
  }
  const total = counts.writes + counts.skips;
  expect(counts.writes, 'the establishing frame must perform real writes').toBeGreaterThan(0);
  return counts.skips / total;
}

describe('hud_perf_budget ARM 2: write-elision skip-rate budget (Node fake-DOM, npm test)', () => {
  for (const shape of ['sim', 'clientworld'] as const) {
    it(`steady-state per-frame painting stays >= the P0 skip-rate floor (${shape} shape)`, () => {
      const skipRate = runSkipRateLoop(shape);
      expect(
        skipRate,
        `${shape}: aggregate hot-DOM skip-rate ${skipRate.toFixed(4)} dropped below the committed P0 floor ${SKIP_RATE_FLOOR}; the write-elision cache collapsed.`,
      ).toBeGreaterThanOrEqual(SKIP_RATE_FLOOR);
    });
  }
});

// --------------------------------------------------------------------------
// ARM 2 (cont.) - allocation budget: the per-frame view cores reuse their container.
// --------------------------------------------------------------------------

function actionBarDeps(): ActionBarDeps {
  return {
    t: (key, values) => (values ? `${key}|${JSON.stringify(values)}` : key),
    abilityName: (def) => def.id,
    itemName: (item) => item.id,
    slotLabel: (slotIndex) => `${slotIndex + 1}`,
  };
}

function idleWorld(): ActionBarWorldInput {
  return {
    player: {
      autoAttack: false,
      dead: false,
      resource: 100,
      cooldowns: new Map(),
      gcdRemaining: 0,
      queuedOnSwing: null,
      pos: { x: 0, y: 0, z: 0 },
    },
    target: null,
    inventory: [],
  };
}

function aurasDeps(): AurasDeps {
  return {
    iconId: (a) => a.id,
    auraName: (a) => a.name,
    formatStacks: (n) => String(n),
  };
}

describe('hud_perf_budget ARM 2: per-frame allocation budget (Node, npm test)', () => {
  it('action_bar_view reuses its state container every tick (no per-frame garbage)', () => {
    const view = createActionBarView(
      {
        slots: [
          {
            slotIndex: 0,
            isAttack: false,
            hasAction: () => true,
            ability: () => ({
              def: {
                id: 'fireball',
                offGcd: false,
                cooldown: 6,
                requiresTarget: false,
                range: 0,
              } as unknown as AbilityDef,
              cost: 0,
            }),
            item: () => null,
            keybindLabel: () => '1',
          },
        ],
      },
      actionBarDeps(),
    );
    const world = idleWorld();
    expect(() =>
      assertAllocationStable(() => view.tick(world), 64, 'action_bar_view'),
    ).not.toThrow();
  });

  // DECISION 15: drive auras_view with both the Sim aura (a positive value) and the
  // ClientWorld mirror (value zeroed online); both must tick into a reused container.
  for (const shape of ['sim', 'clientworld'] as const) {
    it(`auras_view reuses its state container every tick (${shape} shape)`, () => {
      const view = createAurasView('all', aurasDeps());
      const auras: AuraInput[] = [
        {
          id: 'a',
          name: 'A',
          kind: 'buff_ap',
          remaining: 600,
          value: shape === 'sim' ? 50 : 0,
        },
      ];
      expect(() =>
        assertAllocationStable(() => view.tick({ auras }), 64, `auras_view (${shape})`),
      ).not.toThrow();
    });
  }
});

// --------------------------------------------------------------------------
// ARM 3 - perf_tour-delegated (env-gated, perf row).
// --------------------------------------------------------------------------

const TOUR_ENABLED = process.env.HUD_PERF_BUDGET_TOUR === '1';
const tourDescribe = TOUR_ENABLED ? describe : describe.skip;

tourDescribe(
  'hud_perf_budget ARM 3: perf_tour-delegated frame + pool budget (HUD_PERF_BUDGET_TOUR=1)',
  () => {
    // The operator runs `PERF_VIEWPORT=<vp> PERF_OUT=<path> node scripts/perf_tour.mjs`
    // (a real browser over `npm run dev`), then points this arm at the artifact. It reuses
    // the perf_tour measurement path, never a new one.
    const viewport = process.env.HUD_PERF_BUDGET_TOUR_VIEWPORT ?? 'desktop';
    const resultPath = process.env.HUD_PERF_BUDGET_TOUR_RESULT ?? 'tmp/perf-tour-desktop.json';
    const frameRef = process.env.HUD_PERF_BUDGET_TOUR_FRAME_BASELINE
      ? Number(process.env.HUD_PERF_BUDGET_TOUR_FRAME_BASELINE)
      : readBaselineFrameP95();

    function loadArtifact(): {
      summary: Record<string, { frameP95: number; hudHotDomSkipRate: number }>;
      results: Array<{
        viewport: string;
        fctBurst?: { spawnPerWave: number; max: number; min: number; drove: boolean };
      }>;
    } {
      const abs = resultPath.startsWith('/')
        ? resultPath
        : fileURLToPath(new URL(`../${resultPath}`, import.meta.url));
      return JSON.parse(readFileSync(abs, 'utf8'));
    }

    it(`frameP95 stays within the same-machine baseline (${viewport})`, () => {
      const summary = loadArtifact().summary[viewport];
      expect(summary, `perf_tour artifact has no ${viewport} summary`).toBeDefined();
      expect(
        summary.frameP95,
        `${viewport} frameP95 ${summary.frameP95}ms exceeds the baseline ${frameRef}ms (same-machine; on other hardware set HUD_PERF_BUDGET_TOUR_FRAME_BASELINE to a fresh re-run).`,
      ).toBeLessThanOrEqual(frameRef);
    });

    it(`hudHotDomSkipRate stays >= the durable P0 floor (${viewport})`, () => {
      const summary = loadArtifact().summary[viewport];
      expect(summary.hudHotDomSkipRate).toBeGreaterThanOrEqual(SKIP_RATE_FLOOR);
    });

    it(`the FCT pool stays cap-bounded under the scripted AoE burst (${viewport})`, () => {
      const burst = loadArtifact().results.find((r) => r.viewport === viewport)?.fctBurst;
      expect(burst, `perf_tour artifact has no fctBurst for ${viewport}`).toBeDefined();
      if (!burst) return;
      expect(burst.drove).toBe(true);
      expect(burst.min, 'the burst must actually spawn floaters').toBeGreaterThan(0);
      expect(
        burst.max,
        `FCT live nodes ${burst.max} reached the spawn count ${burst.spawnPerWave}; the pool is not bounded.`,
      ).toBeLessThan(burst.spawnPerWave);
      expect(burst.max, 'the bounded pool must re-saturate to the same count each wave').toBe(
        burst.min,
      );
    });
  },
);
