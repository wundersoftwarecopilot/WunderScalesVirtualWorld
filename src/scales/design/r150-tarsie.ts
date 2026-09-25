import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { buildR150 } from './_bodyR150';

/** R150 Tarsie Cromata: chrome body with an inlaid terracotta Tarsie platform. */
const def: ScaleDef = {
  spec: SPECS['r150-tarsie'],
  build: () => buildR150('chrome', 'tarsie'),
};

export default def;
