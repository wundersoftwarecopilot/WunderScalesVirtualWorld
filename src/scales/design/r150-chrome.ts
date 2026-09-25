import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { buildR150 } from './_bodyR150';

/** R150 Chrome: the column dial scale in mirror chrome with a black ribbed rubber mat. */
const def: ScaleDef = {
  spec: SPECS['r150-chrome'],
  build: () => buildR150('chrome', 'mat'),
};

export default def;
