import { afterEach, describe, expect, it } from 'vitest';
import { BUILTIN_WORLD, getActiveWorldContent, setActiveWorldContent } from '../src/sim/data';
import type { WorldContent } from '../src/sim/types';
import { biomeAt, terrainHeight, zoneBiomeAt } from '../src/sim/world';

// The custom-map seam (Phase 0): the terrain function reads the active world
// content registry, defaulting to the built-in world. These tests prove (a) the
// built-in path is unchanged and deterministic, and (b) a custom world actually
// re-shapes the terrain the sim and renderer both sample.

const SEED = 1234;
// A spread of overworld sample points across the three zone bands.
const POINTS: [number, number][] = [
  [0, 0],
  [40, 140],
  [-92, 88],
  [149.5, 295],
  [0, -3],
  [80, 80],
  [-60, 4],
  [120, 360],
];

function sampleDefault(): number[] {
  setActiveWorldContent(null);
  return POINTS.map(([x, z]) => terrainHeight(x, z, SEED));
}

afterEach(() => {
  // Active content is module-global; never leak a custom world into other tests.
  setActiveWorldContent(null);
});

describe('custom-map terrain seam', () => {
  it('defaults to the built-in world', () => {
    expect(getActiveWorldContent()).toBe(BUILTIN_WORLD);
  });

  it('built-in terrain is deterministic across calls', () => {
    const a = sampleDefault();
    const b = sampleDefault();
    expect(a).toEqual(b);
  });

  it('injecting the built-in content as a custom world is byte-identical', () => {
    const golden = sampleDefault();
    // A WorldContent that reuses the exact built-in arrays must reproduce terrain
    // bit-for-bit: this proves the registry indirection added no drift.
    const clone: WorldContent = { ...BUILTIN_WORLD };
    setActiveWorldContent(clone);
    const got = POINTS.map(([x, z]) => terrainHeight(x, z, SEED));
    expect(got).toEqual(golden);
  });

  it('restores the built-in world when cleared', () => {
    const golden = sampleDefault();
    setActiveWorldContent({ ...BUILTIN_WORLD, zones: [BUILTIN_WORLD.zones[0]] });
    setActiveWorldContent(null);
    const got = POINTS.map(([x, z]) => terrainHeight(x, z, SEED));
    expect(got).toEqual(golden);
  });

  it('a terrain edit raises the ground at the stamp centre (sim + render agree)', () => {
    const baseAtOrigin = terrainHeight(0, 0, SEED); // default content
    setActiveWorldContent({
      ...BUILTIN_WORLD,
      terrainEdits: [{ x: 0, z: 0, radius: 25, delta: 12, falloff: 'smooth' }],
    });
    // Smooth falloff is 1.0 at the centre, so the centre rises by exactly delta.
    expect(terrainHeight(0, 0, SEED)).toBeCloseTo(baseAtOrigin + 12, 6);
    // Outside the radius is untouched.
    expect(terrainHeight(100, 0, SEED)).toBeCloseTo(terrainHeightDefaultAt(100, 0), 6);
  });

  it('biome paint overrides shape + biome lookup only inside painted cells', () => {
    const baseBiome = biomeAt(40, 60); // built-in vale here
    const baseH = terrainHeight(40, 60, SEED);
    // Paint a 1-cell peaks patch covering (40,60); everywhere else unpainted.
    setActiveWorldContent({
      ...BUILTIN_WORLD,
      biomePaint: {
        cell: 20,
        cols: 1,
        rows: 1,
        originX: 30,
        originZ: 50,
        ids: [2], // peaks
      },
    });
    expect(biomeAt(40, 60)).toBe('peaks');
    expect(terrainHeight(40, 60, SEED)).not.toBeCloseTo(baseH, 3); // shape changed
    // A point outside the painted cell is unchanged.
    expect(biomeAt(200, 200)).toBe(zoneBiomeAt(200));
    expect(baseBiome).toBe('vale');
  });

  it('a custom single-biome world re-shapes terrain and biome lookup', () => {
    const peaks: WorldContent = {
      ...BUILTIN_WORLD,
      zones: [
        {
          id: 'custom',
          name: 'Custom Peaks',
          zMin: -180,
          zMax: 180,
          levelRange: [1, 10],
          biome: 'peaks',
          hub: { x: 0, z: 0, radius: 20, name: 'Camp' },
          graveyard: { x: 0, z: 0 },
          lakes: [],
          pois: [],
          welcome: '',
        },
      ],
      camps: [],
      roads: [],
    };
    setActiveWorldContent(peaks);
    expect(zoneBiomeAt(50)).toBe('peaks');
    // Peaks biome has a high base elevation, so an arbitrary far point should sit
    // well above the built-in vale terrain at the same spot.
    expect(terrainHeight(60, 60, SEED)).toBeGreaterThan(0);
  });
});

// Helper: sample the built-in terrain at a point without disturbing the active
// content the calling test has set (restores it afterwards is handled by afterEach).
function terrainHeightDefaultAt(x: number, z: number): number {
  const active = getActiveWorldContent();
  setActiveWorldContent(null);
  const h = terrainHeight(x, z, SEED);
  setActiveWorldContent(active === BUILTIN_WORLD ? null : active);
  return h;
}
