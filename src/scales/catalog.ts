import { ALL_SCALE_IDS, type ScaleId } from './specs';
import { stubScale } from './stub';
import type { ScaleDef, ScaleModule } from './types';

/**
 * Collects every scale model under medicale/, industriale/ and design/. A file may default-export
 * one ScaleDef or an array (e.g. one body in several finishes). Helper files without a default
 * export are ignored. Any id still missing falls back to a stub so the world is always complete.
 */
const modules = import.meta.glob<ScaleModule>(['./medicale/*.ts', './industriale/*.ts', './design/*.ts'], { eager: true });

export function loadCatalog(): ScaleDef[] {
  const byId = new Map<ScaleId, ScaleDef>();
  for (const [path, mod] of Object.entries(modules)) {
    const exp = mod.default;
    if (!exp) continue;
    for (const def of Array.isArray(exp) ? exp : [exp]) {
      if (!def?.spec?.id) {
        console.warn('[catalog] ignoring export without spec in', path);
        continue;
      }
      if (byId.has(def.spec.id)) console.warn('[catalog] duplicate scale id', def.spec.id, 'in', path);
      byId.set(def.spec.id, def);
    }
  }
  return ALL_SCALE_IDS.map((id) => byId.get(id) ?? stubScale(id));
}
