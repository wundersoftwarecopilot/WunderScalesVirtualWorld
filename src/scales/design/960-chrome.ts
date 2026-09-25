import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { build960 } from './_body960';

/** 960 Chrome: the low dial scale in mirror chrome with a black ribbed rubber mat. */
const def: ScaleDef = {
  spec: SPECS['960-chrome'],
  build: () => build960('chrome', 'mat'),
};

export default def;
