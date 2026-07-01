// The 3D in-world editor viewport. Reuses the real game Renderer over a frozen Sim
// built from the editor's CustomMap, drives a free editor camera, and re-meshes the
// terrain live on edits. This is the DEFAULT editor mode: you fly over and sculpt
// the actual rendered world. Editor-only (dev tooling); imports the heavy Renderer.

import type * as THREE from 'three';
import { assetsReady } from '../../render/assets/preload';
import { buildPlacedAssets } from '../../render/placed_assets';
import { Renderer } from '../../render/renderer';
import { setActiveWorldContent } from '../../sim/data';
import { Sim } from '../../sim/sim';
import { DT } from '../../sim/types';
import { terrainHeight } from '../../sim/world';
import { type CustomMap, customMapToWorldContent, placementsToRenderAssets } from '../custom_map';
import { EditorCamera } from './editor_camera';

export interface Editor3DHooks {
  // The active tool wants left-drag for editing (so the viewport must not orbit).
  toolActive(): boolean;
  // Pointer began/continued/ended an edit over the terrain surface (world x/z).
  onEditStart(world: { x: number; z: number }, ev: PointerEvent): void;
  onEditMove(world: { x: number; z: number }, ev: PointerEvent): void;
  onEditEnd(ev: PointerEvent): void;
  // The cursor moved over the surface (for the brush gizmo); null when off-terrain.
  onHover(world: { x: number; z: number } | null): void;
}

export class Editor3DViewport {
  private canvas!: HTMLCanvasElement;
  private nameplates!: HTMLDivElement;
  private readonly cam = new EditorCamera();
  private sim: Sim | null = null;
  private renderer: Renderer | null = null;
  // Editor-owned group for live placements (the Renderer ctor builds placements
  // once; this lets us re-instance them as the user places/sculpts).
  private placedGroup: THREE.Group | null = null;
  private raf = 0;
  private lastT = 0;
  private disposed = false;
  private seed = 20061;

  // Interaction state.
  private dragMode: 'none' | 'orbit' | 'pan' | 'edit' = 'none';
  private lastPointer = { x: 0, y: 0 };
  private readonly keys = new Set<string>();

  constructor(
    private readonly parent: HTMLElement,
    private map: CustomMap,
    private readonly hooks: Editor3DHooks,
  ) {
    this.createSurfaces();
  }

  private createSurfaces(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'editor-3d-canvas';
    this.nameplates = document.createElement('div');
    this.nameplates.className = 'editor-3d-nameplates';
    this.parent.append(this.canvas, this.nameplates);
  }

  async start(): Promise<void> {
    if (!this.canvas.isConnected) this.createSurfaces();
    this.seed = this.map.meta.seed;
    const world = customMapToWorldContent(this.map);
    setActiveWorldContent(world);
    await assetsReady();
    if (this.disposed) return;
    // The viewport owns live placements (rebuildPlacements), so strip them from the
    // Sim's world or the Renderer ctor would build a second, frozen copy.
    this.sim = new Sim({
      seed: this.seed,
      playerClass: 'warrior',
      world: { ...world, placements: undefined },
    });
    this.renderer = new Renderer(this.sim, this.canvas, this.nameplates);
    this.rebuildPlacements();
    // Frame the world hub to start.
    const hub = this.map.content.zones[0]?.hub ?? { x: 0, z: 0 };
    this.cam.target.set(hub.x, terrainHeight(hub.x, hub.z, this.seed), hub.z);
    this.attachEvents();
    this.lastT = performance.now();
    this.loop();
  }

  // The renderer's surface raycast for the current cursor (client coords).
  surfaceAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const p = this.renderer?.surfacePoint(clientX, clientY);
    return p ? { x: p.x, z: p.z } : null;
  }

  // Re-mesh terrain after a sculpt/paint edit, then re-seat placements on the new
  // surface so they do not float/sink.
  rebuildTerrain(): void {
    if (!this.renderer) return;
    setActiveWorldContent(customMapToWorldContent(this.map));
    this.renderer.rebuildTerrain();
    this.rebuildPlacements();
  }

  // Re-instance the editor's placed GLB assets (after place/move). Cheap relative
  // to a terrain rebuild; seats each asset on the current terrain height.
  rebuildPlacements(): void {
    if (!this.renderer) return;
    if (this.placedGroup) {
      this.renderer.scene.remove(this.placedGroup);
      // Do NOT dispose: placed assets are clones sharing cached GLB geometry.
      this.placedGroup = null;
    }
    const assets = placementsToRenderAssets(this.map.placements);
    if (assets.length === 0) return;
    this.placedGroup = buildPlacedAssets(assets, this.seed);
    this.renderer.scene.add(this.placedGroup);
  }

  // Swap to a different document (load/new/import) without leaking: rebuild the
  // Sim+Renderer since spawns come from the map (and the GL context is replaced).
  async reload(map: CustomMap): Promise<void> {
    this.map = map;
    this.detachEvents();
    this.teardownEngine();
    await this.start();
  }

  setVisible(v: boolean): void {
    this.parent.style.display = v ? '' : 'none';
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.detachEvents();
    this.teardownEngine();
  }

  // Free the GL context and remove the surfaces. A fresh canvas is needed for a
  // later start() because forceContextLoss() permanently kills this context.
  private teardownEngine(): void {
    cancelAnimationFrame(this.raf);
    if (this.renderer) {
      try {
        this.renderer.editorCam = null;
        this.renderer.webgl.setAnimationLoop(null);
        this.renderer.webgl.dispose();
        this.renderer.webgl.forceContextLoss();
      } catch {
        // GL teardown is best-effort.
      }
    }
    this.renderer = null;
    this.sim = null;
    this.canvas?.remove();
    this.nameplates?.remove();
  }

  // ---- loop ---------------------------------------------------------------

  private loop = (): void => {
    if (this.disposed || !this.renderer || !this.sim) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;

    this.applyKeys(dt);
    // Keep the look target grounded on the (possibly sculpted) terrain.
    this.cam.target.y = terrainHeight(this.cam.target.x, this.cam.target.z, this.seed);
    // Teleport the frozen player to the camera target so foliage/critter LOD stays
    // populated under the cursor (the renderer re-centers dressing on the player).
    const player = this.sim.player;
    if (player) {
      player.pos.x = this.cam.target.x;
      player.pos.z = this.cam.target.z;
      player.pos.y = this.cam.target.y;
    }
    this.renderer.editorCam = this.cam.pose();
    this.renderer.sync(1, DT, null);
    this.raf = requestAnimationFrame(this.loop);
  };

  private applyKeys(dt: number): void {
    const f = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const r = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const u = (this.keys.has('e') ? 1 : 0) - (this.keys.has('q') ? 1 : 0);
    if (f || r || u) this.cam.fly(f, r, u, dt);
  }

  // ---- input --------------------------------------------------------------

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContext);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private detachEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onContext = (e: Event): void => e.preventDefault();

  private onPointerDown = (ev: PointerEvent): void => {
    this.lastPointer = { x: ev.clientX, y: ev.clientY };
    const wantsEdit = ev.button === 0 && this.hooks.toolActive();
    if (wantsEdit) {
      const w = this.surfaceAt(ev.clientX, ev.clientY);
      if (w) {
        this.dragMode = 'edit';
        this.hooks.onEditStart(w, ev);
        this.canvas.setPointerCapture(ev.pointerId);
        return;
      }
    }
    // Middle or shift+drag pans; otherwise orbit.
    this.dragMode = ev.button === 1 || ev.shiftKey ? 'pan' : 'orbit';
    this.canvas.setPointerCapture(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    const dx = ev.clientX - this.lastPointer.x;
    const dy = ev.clientY - this.lastPointer.y;
    this.lastPointer = { x: ev.clientX, y: ev.clientY };
    if (this.dragMode === 'orbit') this.cam.orbit(dx, dy);
    else if (this.dragMode === 'pan') this.cam.pan(dx, dy);
    else if (this.dragMode === 'edit') {
      const w = this.surfaceAt(ev.clientX, ev.clientY);
      if (w) this.hooks.onEditMove(w, ev);
    } else {
      this.hooks.onHover(this.surfaceAt(ev.clientX, ev.clientY));
    }
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (this.dragMode === 'edit') this.hooks.onEditEnd(ev);
    this.dragMode = 'none';
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    this.cam.zoom(ev.deltaY);
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    const k = ev.key.toLowerCase();
    if ('wasdqe'.includes(k)) this.keys.add(k);
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    this.keys.delete(ev.key.toLowerCase());
  };
}
