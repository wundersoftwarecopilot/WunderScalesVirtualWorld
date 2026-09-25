import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { build960 } from './_body960';

/** 960 Glass: chrome body with a clear tempered-glass plate on polished stand-offs. */
const def: ScaleDef = {
  spec: SPECS['960-glass'],
  build: () => build960('chrome', 'glass'),
};

export default def;
