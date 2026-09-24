import { SCALE_IDS } from '../../scales/specs';
import { gridSlots, type ZoneModule } from '../zone';

/** Supermarket + warehouse wing. (Placeholder layout.) */
const zone: ZoneModule = {
  id: 'industriale',
  build({ shell }) {
    const r = shell.inner;
    return { slots: gridSlots(SCALE_IDS.industriale, { minX: r.minX + 4, maxX: r.maxX - 2, minZ: r.minZ + 2, maxZ: r.maxZ - 2 }, -Math.PI / 2) };
  },
};
export default zone;
