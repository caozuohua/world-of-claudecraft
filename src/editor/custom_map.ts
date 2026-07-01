// The CustomMap document: the editor's canonical, serializable map. It carries the
// spatial content (zones/camps/npcs/objects/roads, the ZoneContent shape the marker
// editor already uses) plus the net-new authoring layers (terrain height edits and
// free-form asset placements) and metadata. Pure: no DOM, Vitest-importable.
//
// A CustomMap maps onto the engine's WorldContent (src/sim/types.ts) for play-test:
// content + terrainEdits go straight in; props/playerStart come from the built-in
// world for now; placements render via the editor's asset instancer (not the Sim).

import { BUILTIN_WORLD } from '../sim/data';
import type { BiomePaint, HeightStamp, PlacedAsset, WorldContent } from '../sim/types';
import { assetById } from './asset_catalog.generated';
import type { ZoneContent } from './model';

export const CUSTOM_MAP_VERSION = 1;

// A free-form GLB placement from the asset catalogue (asset_catalog.generated.ts).
// Rendered by the editor/play-test instancer; not a Sim entity (Phase 4).
export interface AssetPlacement {
  assetId: string; // catalogue id, e.g. "props/well"
  x: number;
  z: number;
  rotY: number; // radians
  scale: number;
  collide: boolean;
}

export interface CustomMapMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  seed: number;
}

export interface CustomMap {
  version: number;
  meta: CustomMapMeta;
  content: ZoneContent;
  terrainEdits: HeightStamp[];
  placements: AssetPlacement[];
  biomePaint?: BiomePaint;
}

// The game's fixed offline seed; a fresh map defaults to it so its built-in-derived
// terrain matches what the editor previews. (Mirrors DEFAULT_PLAYTEST_SEED.)
const DEFAULT_SEED = 20061;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// A new map seeded from the built-in world content (so it is immediately playable
// and editable). `now` and `id` are injected (no Date.now/Math.random in callers
// that want determinism; the DOM app passes real values).
export function newCustomMap(name: string, id: string, now: number): CustomMap {
  return {
    version: CUSTOM_MAP_VERSION,
    meta: { id, name, createdAt: now, updatedAt: now, seed: DEFAULT_SEED },
    content: {
      zones: deepClone(BUILTIN_WORLD.zones as ZoneContent['zones']),
      camps: deepClone(BUILTIN_WORLD.camps as ZoneContent['camps']),
      npcs: deepClone(BUILTIN_WORLD.npcs as ZoneContent['npcs']),
      objects: deepClone(BUILTIN_WORLD.groundObjects as ZoneContent['objects']),
      roads: deepClone(BUILTIN_WORLD.roads as ZoneContent['roads']),
    },
    terrainEdits: [],
    placements: [],
  };
}

// Build a CustomMap from a live ZoneContent (the editor's current edits) plus the
// authoring layers. Deep-cloned so the document is independent of further edits.
export function customMapFromContent(
  content: ZoneContent,
  layers: { terrainEdits?: HeightStamp[]; placements?: AssetPlacement[]; meta: CustomMapMeta },
): CustomMap {
  return {
    version: CUSTOM_MAP_VERSION,
    meta: { ...layers.meta },
    content: {
      zones: deepClone(content.zones as ZoneContent['zones']),
      camps: deepClone(content.camps as ZoneContent['camps']),
      npcs: deepClone(content.npcs as ZoneContent['npcs']),
      objects: deepClone(content.objects as ZoneContent['objects']),
      roads: deepClone((content.roads ?? []) as ZoneContent['roads']),
    },
    terrainEdits: deepClone(layers.terrainEdits ?? []),
    placements: deepClone(layers.placements ?? []),
  };
}

// Project a CustomMap onto the engine's WorldContent for play-testing. Props and
// player start come from the built-in world (the editor does not author them yet);
// placements are not Sim entities, so they are carried separately by the renderer.
export function customMapToWorldContent(map: CustomMap): WorldContent {
  return {
    zones: deepClone(map.content.zones as WorldContent['zones']),
    camps: deepClone(map.content.camps as WorldContent['camps']),
    npcs: deepClone(map.content.npcs as WorldContent['npcs']),
    groundObjects: deepClone(map.content.objects as WorldContent['groundObjects']),
    roads: deepClone((map.content.roads ?? BUILTIN_WORLD.roads) as WorldContent['roads']),
    props: deepClone(BUILTIN_WORLD.props),
    playerStart: deepClone(BUILTIN_WORLD.playerStart),
    terrainEdits: deepClone(map.terrainEdits),
    placements: placementsToRenderAssets(map.placements),
    biomePaint: map.biomePaint ? deepClone(map.biomePaint) : undefined,
  };
}

// Resolve editor placements (catalogue id) into render-ready PlacedAssets (GLB
// path). Placements with an unknown id are skipped.
export function placementsToRenderAssets(placements: readonly AssetPlacement[]): PlacedAsset[] {
  const out: PlacedAsset[] = [];
  for (const p of placements) {
    const asset = assetById(p.assetId);
    if (!asset) continue;
    out.push({ path: asset.path, x: p.x, z: p.z, rotY: p.rotY, scale: p.scale });
  }
  return out;
}
