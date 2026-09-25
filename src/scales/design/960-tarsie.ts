import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { build960 } from './_body960';

/** 960 with a Tarsie platform: chrome body, inlaid terracotta tesserae slab in a chrome frame. */
const def: ScaleDef = {
  spec: SPECS['960-tarsie'],
  build: () => build960('chrome', 'tarsie'),
};

export default def;
