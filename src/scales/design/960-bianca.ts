import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { build960 } from './_body960';

/** 960 Bianca: the low dial scale in white epoxy, chrome bezel, black ribbed rubber mat. */
const def: ScaleDef = {
  spec: SPECS['960-bianca'],
  build: () => build960('bianca', 'mat'),
};

export default def;
