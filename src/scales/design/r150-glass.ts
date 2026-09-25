import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { buildR150 } from './_bodyR150';

/** R150 Glass: chrome body and column with a clear tempered-glass platform plate. */
const def: ScaleDef = {
  spec: SPECS['r150-glass'],
  build: () => buildR150('chrome', 'glass'),
};

export default def;
