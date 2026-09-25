import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { buildR150 } from './_bodyR150';

/** R150 Gold: gold-plated base, collar, column and bezel, black ribbed rubber mat. */
const def: ScaleDef = {
  spec: SPECS['r150-gold'],
  build: () => buildR150('gold', 'mat'),
};

export default def;
