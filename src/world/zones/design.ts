import { SCALE_IDS } from '../../scales/specs';
import { gridSlots, type ZoneModule } from '../zone';

/** Design gallery / museum. (Placeholder layout.) */
const zone: ZoneModule = {
  id: 'design',
  build({ shell }) {
    const r = shell.inner;
    return { slots: gridSlots(SCALE_IDS.design, { minX: r.minX + 2, maxX: r.maxX - 2, minZ: r.minZ + 2, maxZ: r.maxZ - 4 }, 0) };
  },
};
export default zone;
