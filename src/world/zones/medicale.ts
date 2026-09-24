import { SCALE_IDS } from '../../scales/specs';
import { gridSlots, type ZoneModule } from '../zone';

/** Clinic / hospital wing. (Placeholder layout.) */
const zone: ZoneModule = {
  id: 'medicale',
  build({ shell }) {
    const r = shell.inner;
    return { slots: gridSlots(SCALE_IDS.medicale, { minX: r.minX + 2, maxX: r.maxX - 4, minZ: r.minZ + 2, maxZ: r.maxZ - 2 }, Math.PI / 2) };
  },
};
export default zone;
