// Renderer for the map editor's freely placed GLB assets (WorldContent.placements).
// Cosmetic and play-test-only: each placement names a public GLB path; we load it
// once, clone it per placement, normalize its size, and seat it on the terrain.
// Loads are async (registered as preloads); models pop in when ready, which is
// fine because placements never affect gameplay.

import * as THREE from 'three';
import type { PlacedAsset } from '../sim/types';
import { terrainHeight } from '../sim/world';
import { loadGltf } from './assets/loader';
import { registerPreload } from './assets/preload';

// Height (yards) a placed model is normalized to before its per-placement scale,
// so arbitrary catalogue GLBs (which vary wildly in source units) land sanely.
const TARGET_HEIGHT = 2.2;

export function buildPlacedAssets(placements: readonly PlacedAsset[], seed: number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'placed-assets';
  if (placements.length === 0) return root;

  // Load each unique GLB once, then clone it for every placement that uses it.
  const byPath = new Map<string, PlacedAsset[]>();
  for (const p of placements) {
    const list = byPath.get(p.path);
    if (list) list.push(p);
    else byPath.set(p.path, [p]);
  }

  for (const [path, items] of byPath) {
    const task = loadGltf(path)
      .then((gltf) => {
        const template = gltf.scene;
        const box = new THREE.Box3().setFromObject(template);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const norm = TARGET_HEIGHT / maxDim;
        for (const it of items) {
          const model = template.clone(true);
          model.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          const s = norm * (it.scale > 0 ? it.scale : 1);
          model.scale.setScalar(s);
          // Seat the model base on the ground: lift by -minY*scale so its lowest
          // point rests at terrainHeight.
          const groundY = terrainHeight(it.x, it.z, seed);
          model.position.set(it.x, groundY - box.min.y * s, it.z);
          model.rotation.y = it.rotY;
          root.add(model);
        }
      })
      .catch(() => {
        // Missing or unreadable GLB: skip. The editor catalogue may list a model
        // that is not present in a given build; one bad asset must not blank the
        // whole scene.
      });
    registerPreload(task);
  }
  return root;
}
