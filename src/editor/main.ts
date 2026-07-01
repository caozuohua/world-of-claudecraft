// Map-editor entry (loaded by editor.html). A dev-only world-authoring tool: it
// loads the built-in world content as a starting point, lets you reposition
// markers, paint terrain height, save/load custom maps, and play-test them in the
// real engine. NOT a production route; does not touch the game client bundle.

import { CAMPS, GROUND_OBJECTS, NPCS, ROADS, ZONES } from '../sim/data';
import './styles.css';
import { EditorApp } from './app';

// Deep clone so editing never mutates the imported module globals (BUILTIN_WORLD
// shares those arrays); the editor works on its own document.
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function boot(): void {
  const mount = document.getElementById('editor-app');
  if (!mount) return;
  const app = new EditorApp(mount, {
    zones: clone(ZONES),
    camps: clone(CAMPS),
    npcs: clone(NPCS),
    objects: clone(GROUND_OBJECTS),
    roads: clone(ROADS),
  });
  // Dev-only handle for debugging and E2E inspection.
  (window as unknown as { __editor?: EditorApp }).__editor = app;
}

boot();
