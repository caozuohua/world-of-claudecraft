// Save/load for CustomMap documents. Split, like src/ui/theme.ts, into a pure
// never-throws (de)serializer (Vitest-tested) and a thin localStorage store. A map
// is a plain JSON artifact, so it round-trips to a file and back. parseMap is
// defensive: it validates and clamps every field and def-fills on garbage so a
// hand-edited or truncated file never crashes the editor.

import type { BiomePaint, HeightStamp } from '../sim/types';
import type { AssetPlacement, CustomMap, CustomMapMeta } from './custom_map';
import { CUSTOM_MAP_VERSION } from './custom_map';

const DEFAULT_SEED = 20061;

export function serializeMap(map: CustomMap): string {
  return JSON.stringify(map, null, 2);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function sanitizeStamp(v: unknown): HeightStamp | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (typeof s.x !== 'number' || typeof s.z !== 'number') return null;
  const radius = num(s.radius, 0);
  if (radius <= 0) return null;
  return {
    x: s.x,
    z: s.z,
    radius,
    delta: num(s.delta, 0),
    falloff: s.falloff === 'flat' ? 'flat' : 'smooth',
  };
}

function sanitizePlacement(v: unknown): AssetPlacement | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (typeof p.assetId !== 'string') return null;
  if (typeof p.x !== 'number' || typeof p.z !== 'number') return null;
  return {
    assetId: p.assetId,
    x: p.x,
    z: p.z,
    rotY: num(p.rotY, 0),
    scale: num(p.scale, 1) || 1,
    collide: p.collide === true,
  };
}

// Validate a biome paint grid: ids length must match cols*rows and cell must be
// positive, else the grid is dropped (returns undefined).
function sanitizeBiomePaint(v: unknown): BiomePaint | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const b = v as Record<string, unknown>;
  const cols = num(b.cols, 0);
  const rows = num(b.rows, 0);
  const cell = num(b.cell, 0);
  if (cols <= 0 || rows <= 0 || cell <= 0) return undefined;
  if (!Array.isArray(b.ids) || b.ids.length !== cols * rows) return undefined;
  const ids = b.ids.map((n) => (n === 0 || n === 1 || n === 2 ? n : 255));
  return { cell, cols, rows, originX: num(b.originX, 0), originZ: num(b.originZ, 0), ids };
}

function sanitizeMeta(v: unknown): CustomMapMeta {
  const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const created = num(m.createdAt, 0);
  return {
    id: str(m.id, ''),
    name: str(m.name, 'Untitled Map'),
    createdAt: created,
    updatedAt: num(m.updatedAt, created),
    seed: num(m.seed, DEFAULT_SEED),
  };
}

// A zone must at least have a numeric z-band and a hub to shape terrain. Missing
// optional arrays are filled, so a partial zone is repaired rather than rejected.
function zoneIsUsable(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const z = v as Record<string, unknown>;
  const hub = z.hub as Record<string, unknown> | undefined;
  return (
    typeof z.zMin === 'number' &&
    typeof z.zMax === 'number' &&
    !!hub &&
    typeof hub.x === 'number' &&
    typeof hub.z === 'number'
  );
}

// Parse anything into a CustomMap, or null if it cannot be salvaged (no usable
// zones). Accepts a JSON string or an already-parsed object.
export function parseMap(raw: unknown): CustomMap | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const content = (o.content && typeof o.content === 'object' ? o.content : {}) as Record<
    string,
    unknown
  >;
  const zones = arr(content.zones).filter(zoneIsUsable);
  if (zones.length === 0) return null; // nothing to render/play
  const npcs = content.npcs && typeof content.npcs === 'object' ? (content.npcs as object) : {};
  return {
    version: num(o.version, CUSTOM_MAP_VERSION),
    meta: sanitizeMeta(o.meta),
    content: {
      // Zones/camps/npcs/objects keep their full shape (the editor and engine read
      // many fields); we only gate zones on the load-bearing ones above.
      zones: zones as CustomMap['content']['zones'],
      camps: arr(content.camps) as CustomMap['content']['camps'],
      npcs: npcs as CustomMap['content']['npcs'],
      objects: arr(content.objects) as CustomMap['content']['objects'],
      roads: arr(content.roads) as CustomMap['content']['roads'],
    },
    terrainEdits: arr(o.terrainEdits)
      .map(sanitizeStamp)
      .filter((s): s is HeightStamp => s !== null),
    placements: arr(o.placements)
      .map(sanitizePlacement)
      .filter((p): p is AssetPlacement => p !== null),
    biomePaint: sanitizeBiomePaint(o.biomePaint),
  };
}

// ---- localStorage store ----------------------------------------------------

const STORE_KEY = 'woc_editor_maps';

interface StoredMaps {
  [id: string]: CustomMap;
}

// Minimal Storage surface so the store is testable with an in-memory mock.
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class MapStore {
  constructor(private readonly storage: KeyValueStore | null = safeLocalStorage()) {}

  private readAll(): StoredMaps {
    if (!this.storage) return {};
    try {
      const raw = this.storage.getItem(STORE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? (obj as StoredMaps) : {};
    } catch {
      return {};
    }
  }

  private writeAll(maps: StoredMaps): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(STORE_KEY, JSON.stringify(maps));
      return true;
    } catch {
      return false;
    }
  }

  list(): CustomMapMeta[] {
    return Object.values(this.readAll())
      .map((m) => parseMap(m)?.meta)
      .filter((m): m is CustomMapMeta => !!m)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  save(map: CustomMap): boolean {
    const all = this.readAll();
    all[map.meta.id] = map;
    return this.writeAll(all);
  }

  load(id: string): CustomMap | null {
    const m = this.readAll()[id];
    return m ? parseMap(m) : null;
  }

  remove(id: string): boolean {
    const all = this.readAll();
    if (!(id in all)) return false;
    delete all[id];
    return this.writeAll(all);
  }
}

function safeLocalStorage(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
