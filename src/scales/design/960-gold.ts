import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { build960 } from './_body960';

/** 960 Gold: gold-plated body and bezel, black ribbed rubber mat (the gallery's warm accent). */
const def: ScaleDef = {
  spec: SPECS['960-gold'],
  build: () => build960('gold', 'mat'),
};

export default def;
