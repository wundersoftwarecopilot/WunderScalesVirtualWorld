import { describe, expect, it } from 'vitest';
import { ALL_SCALE_IDS, SCALE_IDS, SPECS } from '../../src/scales/specs';

describe('scale specs', () => {
  it('has ten models per line', () => {
    expect(SCALE_IDS.medicale).toHaveLength(10);
    expect(SCALE_IDS.industriale).toHaveLength(10);
    expect(SCALE_IDS.design).toHaveLength(10);
    expect(new Set(ALL_SCALE_IDS).size).toBe(30);
  });

  it('puts table-top pieces on pedestals and the rest on the floor', () => {
    for (const id of ALL_SCALE_IDS) {
      const s = SPECS[id];
      expect(s.id).toBe(id);
      if (s.placement === 'pedestal') expect(s.pedestalHeight).toBeGreaterThan(60);
      expect(s.url).toMatch(/^https:\/\/(www|medicale|industriale|design)\.wunder\.it\//);
    }
    // Baby, retail and lab/precision scales go on pedestals.
    for (const id of ['baby02-1', 'superbaby', 'baby02-2', 'ht', 'jsd-dual', 'smart', 'jpp', 'wj600', 'nhb'] as const) expect(SPECS[id].placement).toBe('pedestal');
    // The whole design line stands on the floor.
    for (const id of SCALE_IDS.design) expect(SPECS[id].placement).toBe('floor');
  });
});
