// Map-editor DOM app. Owns the canvas, the pointer interactions (pan, zoom, drag,
// select), and the sidebar (zone framing, kind filters, the selected-marker
// inspector, and export). All transforms and picking are delegated to view.ts and
// the model to model.ts, so this file is just glue + event wiring.

import { setActiveWorldContent } from '../sim/data';
import type { HeightStamp } from '../sim/types';
import { terrainHeight, WATER_LEVEL } from '../sim/world';
import { Editor3DViewport } from './3d/viewport';
import { ASSET_CATALOG, ASSET_CATEGORIES, type AssetEntry } from './asset_catalog.generated';
import { draw, KIND_COLOR } from './canvas';
import {
  type AssetPlacement,
  CUSTOM_MAP_VERSION,
  type CustomMap,
  customMapToWorldContent,
  newCustomMap,
} from './custom_map';
import { downloadMap, pickMapFile } from './file_io';
import {
  buildEntities,
  diffMoved,
  type EditorEntity,
  type EntityKind,
  formatPatch,
  snapshot,
  type ZoneContent,
} from './model';
import { MapStore } from './persist';
import { DEFAULT_PLAYTEST_SEED, launchPlaytest } from './playtest';
import { type Bounds, scatterHills, scatterPlacements } from './procgen';
import { Camera, pickHandle, type ScreenPoint, type Vec2, type Viewport } from './view';

const KINDS: EntityKind[] = ['hub', 'graveyard', 'lake', 'poi', 'camp', 'npc', 'object'];

// Active editor tool. 'select' drags markers (the original behaviour); the elevate
// tools paint additive height stamps; 'place' drops the chosen catalogue asset;
// 'paint' paints biomes; 'region' marquee-selects placements + terrain edits to
// copy and paste.
type Tool = 'select' | 'raise' | 'lower' | 'place' | 'paint' | 'region';

interface RegionBox {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}
interface Clipboard {
  placements: AssetPlacement[]; // relative to center
  edits: HeightStamp[]; // relative to center
}

// Biome ids matching world.ts BIOME_BY_ID; 255 erases a painted cell.
const BIOME_OPTIONS: { id: number; label: string }[] = [
  { id: 0, label: 'Vale' },
  { id: 1, label: 'Marsh' },
  { id: 2, label: 'Peaks' },
  { id: 255, label: 'Erase' },
];

export class EditorApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cam = new Camera({ x: 0, z: 0 }, 2);
  // Rebuilt by loadMap when a different document is loaded, so not readonly.
  private entities: EditorEntity[];
  private base: Map<string, Vec2>;
  private roads: readonly (readonly Vec2[])[];
  private zones: ZoneContent['zones'];

  private readonly visible = new Set<EntityKind>(KINDS);
  private selectedKey: string | null = null;
  private hoverKey: string | null = null;
  private dirty = true;

  // Drag state: either panning the background, or moving a marker with a grab
  // offset (so the marker does not jump to the cursor centre on grab).
  private panning = false;
  private dragKey: string | null = null;
  private grab: Vec2 = { x: 0, z: 0 };
  private lastPointer: ScreenPoint = { sx: 0, sy: 0 };

  private inspector!: HTMLElement;
  private statusEl!: HTMLElement;

  // The live content the markers reference (edits mutate it in place); used to
  // assemble a WorldContent snapshot when launching a play-test. Rebound on load.
  private content: ZoneContent;
  private loadList!: HTMLElement;

  // The working document. Its `content` IS the live ZoneContent above (shared ref,
  // so marker drags show up on save); terrainEdits/placements are authored here.
  private map: CustomMap;

  // 3D in-world editor (the DEFAULT view); the 2D canvas is the secondary symbolic
  // view. Both edit the same `map`.
  private viewMode: '3d' | '2d' = '3d';
  private viewport3d: Editor3DViewport | null = null;
  private stage2d!: HTMLElement;
  private stage3dEl!: HTMLElement;
  private readonly modeButtons = new Map<'3d' | '2d', HTMLButtonElement>();

  private tool: Tool = 'select';
  private brushRadius = 18;
  private brushStrength = 6;
  private painting = false;
  private lastStamp: Vec2 | null = null;
  private cursorWorld: Vec2 | null = null;
  private readonly store = new MapStore();

  // Asset placement state.
  private placeAssetId: string | null = null;
  private placeScale = 1;
  private placeCategory: string = ASSET_CATEGORIES[0] ?? 'props';
  private readonly toolButtons = new Map<Tool, HTMLButtonElement>();
  private scatterCount = 80;
  private paintBiome = 1; // marsh by default (most visible change)
  private readonly biomeCell = 8;

  // Region select + clipboard (copy/paste of placements + terrain edits).
  private regionBox: RegionBox | null = null;
  private regionStart: Vec2 | null = null;
  private selectingRegion = false;
  private regionDownScreen: ScreenPoint = { sx: 0, sy: 0 };
  private clipboard: Clipboard | null = null;

  constructor(
    private readonly root: HTMLElement,
    content: ZoneContent,
  ) {
    this.content = content;
    this.map = {
      version: CUSTOM_MAP_VERSION,
      meta: {
        id: mintId(),
        name: 'Untitled Map',
        createdAt: now(),
        updatedAt: now(),
        seed: DEFAULT_PLAYTEST_SEED,
      },
      content, // shared live ref with the markers
      terrainEdits: [],
      placements: [],
    };
    this.entities = buildEntities(content);
    this.base = snapshot(this.entities);
    this.roads = content.roads ?? [];
    this.zones = content.zones;

    this.root.innerHTML = '';
    this.root.classList.add('editor-root');
    // The 3D viewport and the 2D canvas share the stage area; one is shown at a time.
    const stageWrap = document.createElement('div');
    stageWrap.className = 'editor-stage';
    this.stage3dEl = document.createElement('div');
    this.stage3dEl.className = 'editor-3d-host';
    const stage = document.createElement('div');
    stage.className = 'editor-2d-host';
    this.stage2d = stage;
    this.canvas = document.createElement('canvas');
    stage.appendChild(this.canvas);
    stageWrap.append(this.stage3dEl, stage);
    this.root.appendChild(stageWrap);
    this.root.appendChild(this.buildSidebar());

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;

    this.attachEvents(stage);
    this.resize();
    this.frameAll();
    requestAnimationFrame(this.tick);

    // Boot the 3D viewport (default). Falls back to 2D if WebGL/init fails.
    this.applyViewMode();
    this.boot3d();
  }

  private boot3d(): void {
    if (this.viewport3d) return;
    try {
      this.viewport3d = new Editor3DViewport(this.stage3dEl, this.map, {
        toolActive: () =>
          this.tool === 'raise' ||
          this.tool === 'lower' ||
          this.tool === 'paint' ||
          this.tool === 'place',
        onEditStart: (w) => this.edit3dStart(w),
        onEditMove: (w) => this.edit3dMove(w),
        onEditEnd: () => this.edit3dEnd(),
        onHover: () => {},
      });
      void this.viewport3d.start().catch((e) => {
        console.error('3D viewport failed; falling back to 2D', e);
        this.viewMode = '2d';
        this.applyViewMode();
      });
    } catch (e) {
      console.error('3D viewport unavailable; using 2D', e);
      this.viewMode = '2d';
      this.applyViewMode();
    }
  }

  // ---- 3D edit wiring: raycast world point -> existing mutators -> rebuild ----

  private edit3dStart(w: Vec2): void {
    this.lastStamp = null;
    if (this.tool === 'raise' || this.tool === 'lower') this.stampAt(w);
    else if (this.tool === 'paint') this.paintCellsAt(w);
    else if (this.tool === 'place') this.placeAt(w);
  }

  private edit3dMove(w: Vec2): void {
    if (this.tool === 'raise' || this.tool === 'lower') this.stampAt(w);
    else if (this.tool === 'paint') this.paintCellsAt(w);
    // 'place' is click-only; no drag placement.
  }

  private edit3dEnd(): void {
    if (!this.viewport3d) return;
    if (this.tool === 'raise' || this.tool === 'lower' || this.tool === 'paint') {
      this.viewport3d.rebuildTerrain(); // re-meshes terrain + re-seats placements
    } else if (this.tool === 'place') {
      this.viewport3d.rebuildPlacements();
    }
    this.dirty = true; // keep the 2D view in sync if toggled
  }

  private setViewMode(mode: '3d' | '2d'): void {
    this.viewMode = mode;
    this.applyViewMode();
    if (mode === '3d') this.boot3d();
  }

  private applyViewMode(): void {
    const is3d = this.viewMode === '3d';
    this.stage3dEl.style.display = is3d ? '' : 'none';
    this.stage2d.style.display = is3d ? 'none' : '';
    for (const [m, b] of this.modeButtons) b.classList.toggle('active', m === this.viewMode);
    if (!is3d) {
      this.resize();
      this.dirty = true;
    }
  }

  private vp(): Viewport {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  private visibleEntities(): EditorEntity[] {
    return this.entities.filter((e) => this.visible.has(e.kind));
  }

  // Topmost visible entity under a screen point. Maps entities to flat Handles
  // (id + world x/z + radius) for the pure picker, then resolves the id back.
  private pickEntity(s: ScreenPoint): EditorEntity | null {
    const list = this.visibleEntities();
    const handles = list.map((e) => ({ id: e.key, x: e.point.x, z: e.point.z, radius: e.radius }));
    const hit = pickHandle(handles, s, this.cam, this.vp());
    return hit ? (list.find((e) => e.key === hit.id) ?? null) : null;
  }

  // Lay down an additive height stamp under the brush. Throttled by distance so a
  // drag produces evenly spaced stamps, not thousands. Raise/lower set the sign.
  private stampAt(world: Vec2): void {
    const spacing = this.brushRadius * 0.5;
    if (this.lastStamp) {
      const dx = world.x - this.lastStamp.x;
      const dz = world.z - this.lastStamp.z;
      if (dx * dx + dz * dz < spacing * spacing) return;
    }
    const delta = this.tool === 'lower' ? -this.brushStrength : this.brushStrength;
    this.map.terrainEdits.push({
      x: world.x,
      z: world.z,
      radius: this.brushRadius,
      delta,
      falloff: 'smooth',
    });
    this.lastStamp = { x: world.x, z: world.z };
    // Cap the edit list so a long session cannot bloat the document; drop oldest.
    const MAX = 4000;
    const over = this.map.terrainEdits.length - MAX;
    if (over > 0) this.map.terrainEdits.splice(0, over);
  }

  // Lazily create the biome paint grid covering the world bounds, all unpainted.
  private ensureBiomeGrid(): void {
    if (this.map.biomePaint) return;
    const b = this.worldBounds();
    const cols = Math.ceil((b.maxX - b.minX) / this.biomeCell) + 1;
    const rows = Math.ceil((b.maxZ - b.minZ) / this.biomeCell) + 1;
    this.map.biomePaint = {
      cell: this.biomeCell,
      cols,
      rows,
      originX: b.minX,
      originZ: b.minZ,
      ids: new Array(cols * rows).fill(255),
    };
  }

  // Paint biome cells under the brush. 255 erases. Cells outside the grid are
  // ignored (the grid spans the world bounds).
  private paintCellsAt(world: Vec2): void {
    this.ensureBiomeGrid();
    const bp = this.map.biomePaint;
    if (!bp) return;
    const r = this.brushRadius;
    const c0 = Math.floor((world.x - r - bp.originX) / bp.cell);
    const c1 = Math.floor((world.x + r - bp.originX) / bp.cell);
    const r0 = Math.floor((world.z - r - bp.originZ) / bp.cell);
    const r1 = Math.floor((world.z + r - bp.originZ) / bp.cell);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (col < 0 || col >= bp.cols || row < 0 || row >= bp.rows) continue;
        const cx = bp.originX + (col + 0.5) * bp.cell;
        const cz = bp.originZ + (row + 0.5) * bp.cell;
        const dx = cx - world.x;
        const dz = cz - world.z;
        if (dx * dx + dz * dz <= r * r) bp.ids[row * bp.cols + col] = this.paintBiome;
      }
    }
    this.map.meta.updatedAt = now();
  }

  // Drop the chosen catalogue asset at a world point. Rotation is varied per
  // placement (editor RNG, never sim) so repeated drops do not look stamped.
  private placeAt(world: Vec2): void {
    if (!this.placeAssetId) {
      this.statusEl.textContent = 'Pick an asset first.';
      return;
    }
    this.map.placements.push({
      assetId: this.placeAssetId,
      x: world.x,
      z: world.z,
      rotY: Math.random() * Math.PI * 2,
      scale: this.placeScale,
      collide: false,
    });
    this.map.meta.updatedAt = now();
  }

  private resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dirty = true;
  };

  private tick = (): void => {
    if (this.dirty) {
      // Only paint the 2D canvas when it is the active view (the 3D viewport runs
      // its own render loop). The inspector/status still updates in both modes.
      if (this.viewMode === '2d') {
        draw(this.ctx, this.cam, this.vp(), {
          entities: this.visibleEntities(),
          roads: this.roads,
          selectedKey: this.selectedKey,
          hoverKey: this.hoverKey,
          terrainEdits: this.map.terrainEdits,
          placements: this.map.placements,
          biomePaint: this.map.biomePaint ?? null,
          region: this.tool === 'region' ? this.regionBox : null,
          brush:
            (this.tool !== 'raise' && this.tool !== 'lower' && this.tool !== 'paint') ||
            !this.cursorWorld
              ? null
              : {
                  x: this.cursorWorld.x,
                  z: this.cursorWorld.z,
                  radius: this.brushRadius,
                  raise: this.tool !== 'lower',
                },
        });
      }
      this.renderInspector();
      this.dirty = false;
    }
    requestAnimationFrame(this.tick);
  };

  private pointerAt(ev: { clientX: number; clientY: number }): ScreenPoint {
    const r = this.canvas.getBoundingClientRect();
    return { sx: ev.clientX - r.left, sy: ev.clientY - r.top };
  }

  private attachEvents(stage: HTMLElement): void {
    window.addEventListener('resize', this.resize);

    stage.addEventListener('pointerdown', (ev) => {
      const s = this.pointerAt(ev);
      this.lastPointer = s;
      // Region tool: drag a marquee, or single-click to paste the clipboard.
      if (this.tool === 'region' && ev.button === 0) {
        this.selectingRegion = true;
        this.regionStart = this.cam.screenToWorld(s, this.vp());
        this.regionDownScreen = s;
        this.regionBox = {
          minX: this.regionStart.x,
          minZ: this.regionStart.z,
          maxX: this.regionStart.x,
          maxZ: this.regionStart.z,
        };
        stage.setPointerCapture(ev.pointerId);
        this.dirty = true;
        return;
      }
      // Place tool: drop the chosen asset at the click (no drag).
      if (this.tool === 'place' && ev.button === 0) {
        this.placeAt(this.cam.screenToWorld(s, this.vp()));
        this.dirty = true;
        return;
      }
      // Elevate + biome paint use a continuous brush; alt/right-drag still pans.
      if (
        (this.tool === 'raise' || this.tool === 'lower' || this.tool === 'paint') &&
        ev.button === 0
      ) {
        this.painting = true;
        this.lastStamp = null;
        const w = this.cam.screenToWorld(s, this.vp());
        if (this.tool === 'paint') this.paintCellsAt(w);
        else this.stampAt(w);
        stage.setPointerCapture(ev.pointerId);
        this.dirty = true;
        return;
      }
      const hit = this.pickEntity(s);
      if (hit) {
        this.dragKey = hit.key;
        this.selectedKey = hit.key;
        const world = this.cam.screenToWorld(s, this.vp());
        this.grab = { x: world.x - hit.point.x, z: world.z - hit.point.z };
      } else {
        this.panning = true;
        this.selectedKey = null;
      }
      stage.setPointerCapture(ev.pointerId);
      this.dirty = true;
    });

    stage.addEventListener('pointermove', (ev) => {
      const s = this.pointerAt(ev);
      const dx = s.sx - this.lastPointer.sx;
      const dy = s.sy - this.lastPointer.sy;
      this.lastPointer = s;
      this.cursorWorld = this.cam.screenToWorld(s, this.vp());
      if (this.selectingRegion && this.regionStart) {
        const w = this.cursorWorld;
        this.regionBox = {
          minX: Math.min(this.regionStart.x, w.x),
          minZ: Math.min(this.regionStart.z, w.z),
          maxX: Math.max(this.regionStart.x, w.x),
          maxZ: Math.max(this.regionStart.z, w.z),
        };
        this.dirty = true;
      } else if (this.painting) {
        if (this.tool === 'paint') this.paintCellsAt(this.cursorWorld);
        else this.stampAt(this.cursorWorld);
        this.dirty = true;
      } else if (this.dragKey) {
        const e = this.entities.find((x) => x.key === this.dragKey);
        if (e) {
          e.point.x = this.cursorWorld.x - this.grab.x;
          e.point.z = this.cursorWorld.z - this.grab.z;
          this.dirty = true;
        }
      } else if (this.panning) {
        this.cam.panByPixels(dx, dy);
        this.dirty = true;
      } else if (this.tool !== 'select') {
        this.dirty = true; // refresh the brush cursor preview
      } else {
        const hit = this.pickEntity(s);
        const key = hit ? hit.key : null;
        if (key !== this.hoverKey) {
          this.hoverKey = key;
          stage.style.cursor = key ? 'grab' : 'default';
          this.dirty = true;
        }
      }
    });

    const end = (ev: PointerEvent): void => {
      this.panning = false;
      this.dragKey = null;
      if (this.selectingRegion) {
        this.selectingRegion = false;
        const moved =
          Math.abs(this.lastPointer.sx - this.regionDownScreen.sx) +
          Math.abs(this.lastPointer.sy - this.regionDownScreen.sy);
        // A click (no real drag) with a clipboard pastes here; a drag selects.
        if (moved < 5 && this.clipboard && this.regionStart) {
          this.pasteAt(this.regionStart);
          this.regionBox = null;
        }
      }
      if (this.painting) {
        this.painting = false;
        this.lastStamp = null;
        this.map.meta.updatedAt = now();
      }
      try {
        stage.releasePointerCapture(ev.pointerId);
      } catch {
        // pointer capture may already be gone; ignore.
      }
      this.dirty = true;
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    stage.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        const factor = Math.exp(-ev.deltaY * 0.0015);
        this.cam.zoomAt(this.pointerAt(ev), factor, this.vp());
        this.dirty = true;
      },
      { passive: false },
    );
  }

  private frameAll(): void {
    const pts = this.entities.map((e) => e.point);
    if (pts.length === 0) return;
    const min = { x: Math.min(...pts.map((p) => p.x)), z: Math.min(...pts.map((p) => p.z)) };
    const max = { x: Math.max(...pts.map((p) => p.x)), z: Math.max(...pts.map((p) => p.z)) };
    this.cam.frame(min, max, this.vp());
    this.dirty = true;
  }

  private frameZone(zoneId: string): void {
    const own = this.entities.filter((e) => e.zoneId === zoneId);
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone || own.length === 0) return;
    const xs = own.map((e) => e.point.x);
    const min = { x: Math.min(...xs), z: zone.zMin };
    const max = { x: Math.max(...xs), z: zone.zMax };
    this.cam.frame(min, max, this.vp());
    this.dirty = true;
  }

  // ---- Sidebar ----------------------------------------------------------

  private buildSidebar(): HTMLElement {
    const side = document.createElement('aside');
    side.className = 'editor-side';

    side.appendChild(h('h1', 'Map Editor'));
    side.appendChild(
      h(
        'p',
        '3D: drag to orbit, scroll to zoom, WASD to fly. Pick a tool, then drag on the ground to edit.',
        'muted',
      ),
    );

    side.appendChild(h('h2', 'View'));
    const viewRow = document.createElement('div');
    viewRow.className = 'row wrap';
    this.modeButtons.clear();
    for (const m of ['3d', '2d'] as const) {
      const b = button(m === '3d' ? '3D world' : '2D symbolic', () => this.setViewMode(m));
      if (m === this.viewMode) b.classList.add('active');
      this.modeButtons.set(m, b);
      viewRow.appendChild(b);
    }
    side.appendChild(viewRow);

    side.appendChild(h('h2', 'Tools'));
    const tools = document.createElement('div');
    tools.className = 'row wrap tools';
    const toolDefs: { tool: Tool; label: string }[] = [
      { tool: 'select', label: 'Select' },
      { tool: 'raise', label: 'Raise' },
      { tool: 'lower', label: 'Lower' },
      { tool: 'paint', label: 'Paint' },
      { tool: 'place', label: 'Place' },
      { tool: 'region', label: 'Region' },
    ];
    this.toolButtons.clear();
    for (const def of toolDefs) {
      const b = button(def.label, () => this.setTool(def.tool));
      if (def.tool === this.tool) b.classList.add('active');
      this.toolButtons.set(def.tool, b);
      tools.appendChild(b);
    }
    side.appendChild(tools);
    side.appendChild(this.brushControls());
    side.appendChild(this.biomeControls());
    side.appendChild(this.regionControls());
    side.appendChild(this.assetPalette());
    side.appendChild(this.proceduralControls());

    side.appendChild(h('h2', 'Frame'));
    const frames = document.createElement('div');
    frames.className = 'row wrap';
    const all = button('All', () => this.frameAll());
    frames.appendChild(all);
    for (const z of this.zones) frames.appendChild(button(z.name, () => this.frameZone(z.id)));
    side.appendChild(frames);

    side.appendChild(h('h2', 'Layers'));
    const layers = document.createElement('div');
    layers.className = 'layers';
    for (const kind of KINDS) {
      const id = `layer-${kind}`;
      const wrap = document.createElement('label');
      wrap.className = 'layer';
      wrap.htmlFor = id;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) this.visible.add(kind);
        else this.visible.delete(kind);
        this.dirty = true;
      });
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = KIND_COLOR[kind];
      wrap.append(cb, sw, document.createTextNode(kind));
      layers.appendChild(wrap);
    }
    side.appendChild(layers);

    side.appendChild(h('h2', 'Selection'));
    this.inspector = document.createElement('div');
    this.inspector.className = 'inspector';
    side.appendChild(this.inspector);

    side.appendChild(h('h2', 'Play test'));
    side.appendChild(
      h('p', 'Boot the game on this map (offline, current edits included).', 'muted'),
    );
    const playBtn = button('Play test this map', () => this.playtest());
    playBtn.classList.add('primary');
    side.appendChild(playBtn);

    side.appendChild(h('h2', 'Map'));
    const nameRow = document.createElement('div');
    nameRow.className = 'coord';
    nameRow.appendChild(h('span', 'name', 'axis'));
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = this.map.meta.name;
    nameInput.addEventListener('change', () => {
      this.map.meta.name = nameInput.value.trim() || 'Untitled Map';
    });
    nameRow.appendChild(nameInput);
    side.appendChild(nameRow);
    const mapRow1 = document.createElement('div');
    mapRow1.className = 'row wrap';
    mapRow1.append(
      button('Save', () => this.saveMap()),
      button('Load', () => this.openLoadList()),
      button('New', () => this.newMap()),
    );
    side.appendChild(mapRow1);
    const mapRow2 = document.createElement('div');
    mapRow2.className = 'row wrap';
    mapRow2.append(
      button('Download', () => this.download()),
      button('Import', () => this.importFile()),
    );
    side.appendChild(mapRow2);
    this.loadList = document.createElement('div');
    this.loadList.className = 'load-list';
    side.appendChild(this.loadList);

    side.appendChild(h('h2', 'Export'));
    const exportBtn = button('Copy patch to clipboard', () => this.exportPatch());
    side.appendChild(exportBtn);
    const jsonBtn = button('Copy positions JSON', () => this.exportJson());
    side.appendChild(jsonBtn);
    this.statusEl = h('div', '', 'status');
    side.appendChild(this.statusEl);

    return side;
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const [t, b] of this.toolButtons) b.classList.toggle('active', t === tool);
    if (tool !== 'select') this.selectedKey = null;
    this.dirty = true;
  }

  // A labelled range slider whose label shows the live value.
  private slider(
    label: string,
    min: number,
    max: number,
    value: number,
    step: number,
    onInput: (v: number) => void,
  ): HTMLElement {
    const row = document.createElement('label');
    row.className = 'slider';
    const span = h('span', `${label}: ${value}`);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      span.textContent = `${label}: ${v}`;
      onInput(v);
    });
    row.append(span, input);
    return row;
  }

  private brushControls(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'brush';
    wrap.appendChild(
      this.slider('Brush size', 4, 60, this.brushRadius, 1, (v) => {
        this.brushRadius = v;
        this.dirty = true;
      }),
    );
    wrap.appendChild(
      this.slider('Strength', 1, 30, this.brushStrength, 1, (v) => {
        this.brushStrength = v;
      }),
    );
    const clear = button('Clear terrain edits', () => {
      this.map.terrainEdits = [];
      this.map.meta.updatedAt = now();
      this.dirty = true;
    });
    clear.classList.add('small');
    wrap.appendChild(clear);
    return wrap;
  }

  // Biome paint: choose which biome the Paint tool stamps (or Erase). Painting
  // overrides terrain shape and colour in those cells.
  private biomeControls(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'brush';
    wrap.appendChild(h('div', 'Paint biome:', 'muted'));
    const row = document.createElement('div');
    row.className = 'row wrap';
    const btns = new Map<number, HTMLButtonElement>();
    for (const opt of BIOME_OPTIONS) {
      const b = button(opt.label, () => {
        this.paintBiome = opt.id;
        for (const [id, el] of btns) el.classList.toggle('active', id === opt.id);
        this.setTool('paint');
      });
      if (opt.id === this.paintBiome) b.classList.add('active');
      btns.set(opt.id, b);
      row.appendChild(b);
    }
    wrap.appendChild(row);
    const clear = button('Clear biome paint', () => {
      this.map.biomePaint = undefined;
      this.dirty = true;
    });
    clear.classList.add('small');
    wrap.appendChild(clear);
    return wrap;
  }

  // Region copy/paste: draw a box with the Region tool, Copy, then click the map
  // (Region tool) to paste, or use Paste to drop it beside the selection.
  private regionControls(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'brush';
    wrap.appendChild(h('p', 'Region tool: drag a box, Copy, then click to paste.', 'muted'));
    const row = document.createElement('div');
    row.className = 'row wrap';
    row.append(
      button('Copy region', () => this.copyRegion()),
      button('Paste beside', () => this.pasteBeside()),
    );
    wrap.appendChild(row);
    return wrap;
  }

  private copyRegion(): void {
    if (!this.regionBox) {
      this.statusEl.textContent = 'Draw a region first (Region tool).';
      return;
    }
    const b = this.regionBox;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const inBox = (x: number, z: number): boolean =>
      x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
    const placements = this.map.placements
      .filter((p) => inBox(p.x, p.z))
      .map((p) => ({ ...p, x: p.x - cx, z: p.z - cz }));
    const edits = this.map.terrainEdits
      .filter((e) => inBox(e.x, e.z))
      .map((e) => ({ ...e, x: e.x - cx, z: e.z - cz }));
    this.clipboard = { placements, edits };
    this.statusEl.textContent = `Copied ${placements.length} assets, ${edits.length} edits`;
  }

  private pasteAt(world: Vec2): void {
    if (!this.clipboard) return;
    for (const p of this.clipboard.placements) {
      this.map.placements.push({ ...p, x: p.x + world.x, z: p.z + world.z });
    }
    for (const e of this.clipboard.edits) {
      this.map.terrainEdits.push({ ...e, x: e.x + world.x, z: e.z + world.z });
    }
    this.map.meta.updatedAt = now();
    this.dirty = true;
    const n = this.clipboard.placements.length + this.clipboard.edits.length;
    this.statusEl.textContent = `Pasted ${n} items`;
  }

  private pasteBeside(): void {
    if (!this.clipboard || !this.regionBox) {
      this.statusEl.textContent = 'Copy a region first, then Paste.';
      return;
    }
    const b = this.regionBox;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    this.pasteAt({ x: cx + (b.maxX - b.minX) + 4, z: cz });
  }

  // The asset palette: pick a category, search, and choose a GLB to place. The
  // chosen asset arms the Place tool; clicking the map drops it.
  private assetPalette(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'palette';

    const cat = document.createElement('select');
    for (const c of ASSET_CATEGORIES) {
      const n = ASSET_CATALOG.filter((a) => a.category === c).length;
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `${c} (${n})`;
      cat.appendChild(opt);
    }
    cat.value = this.placeCategory;

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search assets...';

    const list = document.createElement('div');
    list.className = 'asset-list';
    const chosen = h('div', 'No asset chosen', 'muted');

    const render = (): void => {
      const q = search.value.trim().toLowerCase();
      const items = ASSET_CATALOG.filter(
        (a) =>
          a.category === cat.value &&
          (!q || a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)),
      ).slice(0, 150);
      list.innerHTML = '';
      if (items.length === 0) {
        list.appendChild(h('p', 'No matches.', 'muted'));
        return;
      }
      for (const a of items) this.assetButton(a, list, chosen);
    };
    cat.addEventListener('change', () => {
      this.placeCategory = cat.value;
      render();
    });
    search.addEventListener('input', render);

    wrap.append(cat, search, list, chosen);
    wrap.appendChild(
      this.slider('Asset scale', 0.2, 5, this.placeScale, 0.1, (v) => {
        this.placeScale = v;
      }),
    );
    const undo = button('Remove last placement', () => {
      this.map.placements.pop();
      this.dirty = true;
    });
    undo.classList.add('small');
    const clearP = button('Clear placements', () => {
      this.map.placements = [];
      this.dirty = true;
    });
    clearP.classList.add('small');
    wrap.append(undo, clearP);
    render();
    return wrap;
  }

  private assetButton(a: AssetEntry, list: HTMLElement, chosen: HTMLElement): void {
    const b = button(a.label, () => {
      this.placeAssetId = a.id;
      chosen.textContent = `Placing: ${a.label}`;
      chosen.className = 'chosen';
      this.setTool('place');
      for (const el of list.querySelectorAll('.active')) el.classList.remove('active');
      b.classList.add('active');
    });
    b.classList.add('asset-item');
    if (a.id === this.placeAssetId) b.classList.add('active');
    list.appendChild(b);
  }

  private proceduralControls(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'brush';
    wrap.appendChild(h('h2', 'Procedural'));
    wrap.appendChild(
      this.slider('Count', 10, 400, this.scatterCount, 10, (v) => {
        this.scatterCount = v;
      }),
    );
    const scatter = button('Scatter selected category', () => this.generateScatter());
    scatter.classList.add('primary');
    wrap.appendChild(scatter);
    const hills = button('Generate rolling hills', () => this.generateHills());
    wrap.appendChild(hills);
    return wrap;
  }

  // World bounds for procedural fill: the full x strip and the union of zone z-bands,
  // inset a little from the rim.
  private worldBounds(): Bounds {
    const zones = this.map.content.zones;
    const minZ = Math.min(...zones.map((z) => z.zMin));
    const maxZ = Math.max(...zones.map((z) => z.zMax));
    return { minX: -176, maxX: 176, minZ: minZ + 8, maxZ: maxZ - 8 };
  }

  // Reject underwater points and hub interiors. Terrain is sampled against this
  // map's world (set active for the duration) so edits/zones are honoured.
  private withMapTerrain<T>(fn: (avoid: (x: number, z: number) => boolean) => T): T {
    setActiveWorldContent(customMapToWorldContent(this.map));
    try {
      const seed = this.map.meta.seed;
      const zones = this.map.content.zones;
      const avoid = (x: number, z: number): boolean => {
        if (terrainHeight(x, z, seed) < WATER_LEVEL + 1) return true;
        for (const zn of zones) {
          const dx = x - zn.hub.x;
          const dz = z - zn.hub.z;
          if (Math.sqrt(dx * dx + dz * dz) < zn.hub.radius + 6) return true;
        }
        return false;
      };
      return fn(avoid);
    } finally {
      setActiveWorldContent(null);
    }
  }

  private generateScatter(): void {
    const ids = ASSET_CATALOG.filter((a) => a.category === this.placeCategory).map((a) => a.id);
    if (ids.length === 0) {
      this.statusEl.textContent = 'No assets in that category.';
      return;
    }
    const seed = (this.map.meta.seed ^ (this.map.placements.length * 2654435761)) >>> 0;
    const placed = this.withMapTerrain((avoid) =>
      scatterPlacements({
        assetIds: ids,
        count: this.scatterCount,
        bounds: this.worldBounds(),
        seed,
        minScale: 0.7,
        maxScale: 1.6,
        avoid,
      }),
    );
    this.map.placements.push(...placed);
    this.map.meta.updatedAt = now();
    this.dirty = true;
    this.statusEl.textContent = `Scattered ${placed.length} ${this.placeCategory}`;
  }

  private generateHills(): void {
    const seed = (this.map.meta.seed ^ (this.map.terrainEdits.length * 40503)) >>> 0;
    const hills = this.withMapTerrain((avoid) =>
      scatterHills({
        count: Math.max(6, Math.round(this.scatterCount / 6)),
        bounds: this.worldBounds(),
        seed,
        minRadius: 14,
        maxRadius: 40,
        minHeight: 4,
        maxHeight: 16,
        avoid,
      }),
    );
    this.map.terrainEdits.push(...hills);
    this.map.meta.updatedAt = now();
    this.dirty = true;
    this.statusEl.textContent = `Added ${hills.length} hills`;
  }

  private playtest(): void {
    const world = customMapToWorldContent(this.map);
    this.statusEl.textContent = 'Launching play-test...';
    const ok = launchPlaytest(world, {
      seed: this.map.meta.seed,
      playerClass: 'warrior',
      playerName: 'Mapmaker',
    });
    if (!ok) this.statusEl.textContent = 'Could not start play-test (storage blocked).';
  }

  private saveMap(): void {
    this.map.meta.updatedAt = now();
    const ok = this.store.save(this.map);
    this.statusEl.textContent = ok
      ? `Saved "${this.map.meta.name}"`
      : 'Save failed (storage blocked).';
  }

  private openLoadList(): void {
    const metas = this.store.list();
    this.loadList.innerHTML = '';
    if (metas.length === 0) {
      this.loadList.appendChild(h('p', 'No saved maps yet.', 'muted'));
      return;
    }
    for (const m of metas) {
      const row = document.createElement('div');
      row.className = 'row load-row';
      const open = button(m.name, () => {
        const loaded = this.store.load(m.id);
        if (loaded) this.loadMap(loaded);
      });
      open.classList.add('grow');
      const del = button('x', () => {
        this.store.remove(m.id);
        this.openLoadList();
      });
      del.classList.add('small');
      row.append(open, del);
      this.loadList.appendChild(row);
    }
  }

  private async importFile(): Promise<void> {
    const map = await pickMapFile();
    if (map) {
      this.loadMap(map);
      this.statusEl.textContent = `Imported "${map.meta.name}"`;
    } else {
      this.statusEl.textContent = 'Import cancelled or invalid file.';
    }
  }

  private download(): void {
    this.map.meta.updatedAt = now();
    downloadMap(this.map);
    this.statusEl.textContent = `Downloaded "${this.map.meta.name}"`;
  }

  private newMap(): void {
    this.loadMap(newCustomMap('Untitled Map', mintId(), now()));
    this.statusEl.textContent = 'New map (built-in world).';
  }

  // Replace the whole working document and rebuild the editor over its content.
  private loadMap(map: CustomMap): void {
    this.map = map;
    this.content = map.content;
    this.entities = buildEntities(map.content);
    this.base = snapshot(this.entities);
    this.roads = map.content.roads ?? [];
    this.zones = map.content.zones;
    this.selectedKey = null;
    this.hoverKey = null;
    this.loadList.innerHTML = '';
    this.frameAll();
    this.dirty = true;
    // Rebuild the 3D world for the new document (spawns/terrain differ).
    if (this.viewport3d) void this.viewport3d.reload(map);
  }

  private renderInspector(): void {
    const e = this.entities.find((x) => x.key === this.selectedKey);
    const moved = diffMoved(this.entities, this.base).length;
    this.statusEl.textContent = moved ? `${moved} marker(s) moved` : 'No changes yet';
    if (!e) {
      this.inspector.innerHTML = '<p class="muted">Nothing selected. Click a marker.</p>';
      return;
    }
    this.inspector.innerHTML = '';
    this.inspector.appendChild(h('div', `${e.kind}: ${e.label}`, 'sel-label'));
    this.inspector.appendChild(this.coordRow('x', e, 'x'));
    this.inspector.appendChild(this.coordRow('z', e, 'z'));
    const reset = button('Reset position', () => {
      const o = this.base.get(e.key);
      if (o) {
        e.point.x = o.x;
        e.point.z = o.z;
        this.dirty = true;
      }
    });
    reset.classList.add('small');
    this.inspector.appendChild(reset);
  }

  private coordRow(axis: 'x' | 'z', e: EditorEntity, field: 'x' | 'z'): HTMLElement {
    const row = document.createElement('div');
    row.className = 'coord';
    row.appendChild(h('span', axis, 'axis'));
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.5';
    input.value = String(round2(e.point[field]));
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) {
        e.point[field] = v;
        this.dirty = true;
      }
    });
    row.appendChild(input);
    return row;
  }

  private async exportPatch(): Promise<void> {
    const text = formatPatch(diffMoved(this.entities, this.base));
    await this.copy(text, 'Patch copied');
  }

  private async exportJson(): Promise<void> {
    const data = this.entities.map((e) => ({
      key: e.key,
      kind: e.kind,
      label: e.label,
      zoneId: e.zoneId,
      x: round2(e.point.x),
      z: round2(e.point.z),
    }));
    await this.copy(JSON.stringify(data, null, 2), 'JSON copied');
  }

  private async copy(text: string, ok: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.statusEl.textContent = ok;
    } catch {
      // Clipboard blocked (no user gesture / insecure context): fall back to a log
      // so the operator can still grab the text from devtools.
      this.statusEl.textContent = 'Clipboard blocked; printed to console';
      console.log(text);
    }
  }
}

// Editor UI helpers (not sim code): wall-clock + ids are fine here.
function now(): number {
  return Date.now();
}
function mintId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `map-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function h(tag: string, text: string, cls?: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
