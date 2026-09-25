import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { buildR150 } from './_bodyR150';

/** R150 Bianca: the column dial scale in white epoxy, chrome bezel, black ribbed rubber mat. */
const def: ScaleDef = {
  spec: SPECS['r150-bianca'],
  build: () => buildR150('bianca', 'mat'),
};

export default def;
