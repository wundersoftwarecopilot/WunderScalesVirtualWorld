import { URLS } from '../brand/urls';

export type Line = 'medicale' | 'industriale' | 'design';
export type Placement = 'floor' | 'pedestal';

export const SCALE_IDS = {
  medicale: ['r2020', 'c202', 'de20', 'rw20-sedia', 'pl-vega', 'wba300', 'baby02-1', 'superbaby', 'baby02-2', 'ht'],
  industriale: ['wp4-1212', 'wp4-u', 'tpx-c', 'wx-wpa', 'cx', 'jsd-dual', 'smart', 'jpp', 'wj600', 'nhb'],
  design: [
    '960-bianca',
    '960-chrome',
    '960-glass',
    '960-gold',
    '960-tarsie',
    'r150-bianca',
    'r150-chrome',
    'r150-glass',
    'r150-gold',
    'r150-tarsie',
  ],
} as const;

export type ScaleId = (typeof SCALE_IDS)[Line][number];

export interface ScaleSpec {
  id: ScaleId;
  /** Commercial model name (metadata only: never drawn, the world has no text). */
  name: string;
  line: Line;
  placement: Placement;
  /** Product page when known, otherwise the division home page. */
  url: string;
  /** Approximate overall size in cm: w = X (left-right), d = Z (front-back), h = Y. */
  approx: { w: number; d: number; h: number };
  /** Pedestal height in cm for table-top pieces (museum plinth). */
  pedestalHeight?: number;
}

const M = 'https://medicale.wunder.it/it/';
const I = 'https://industriale.wunder.it/it/';
const D = 'https://design.wunder.it/it/';

export const SPECS: Record<ScaleId, ScaleSpec> = {
  // ---- Medicale ----
  r2020: { id: 'r2020', name: 'R2020', line: 'medicale', placement: 'floor', url: M + 'pesapersone-digitali/1478-r2020.html', approx: { w: 40, d: 45, h: 212 } },
  c202: { id: 'c202', name: 'C202', line: 'medicale', placement: 'floor', url: M + 'pesapersone/1003-c202.html', approx: { w: 45, d: 60, h: 150 } },
  de20: { id: 'de20', name: 'DE20', line: 'medicale', placement: 'floor', url: M + 'ausili/1477-de-20.html', approx: { w: 59, d: 104, h: 96 } },
  'rw20-sedia': { id: 'rw20-sedia', name: 'RW2.0-SEDIA', line: 'medicale', placement: 'floor', url: M + 'bilance-con-corrimano/1386-rw20-sedia.html', approx: { w: 84, d: 116, h: 95 } },
  'pl-vega': { id: 'pl-vega', name: 'PL-VEGA', line: 'medicale', placement: 'floor', url: M + 'letti-bilancia/1018-pl-vega.html', approx: { w: 102, d: 222, h: 84 } },
  wba300: { id: 'wba300', name: 'WBA300', line: 'medicale', placement: 'floor', url: M + 'pesapersone/1004-wba.html', approx: { w: 45, d: 55, h: 88 } },
  'baby02-1': { id: 'baby02-1', name: 'BABY02-1', line: 'medicale', placement: 'pedestal', url: M + 'pesaneonati/1019-baby-02-1.html', approx: { w: 56, d: 45, h: 46 }, pedestalHeight: 85 },
  superbaby: { id: 'superbaby', name: 'SUPERBABY', line: 'medicale', placement: 'pedestal', url: M + 'pesaneonati/1021-superbaby.html', approx: { w: 57, d: 32, h: 20 }, pedestalHeight: 85 },
  'baby02-2': { id: 'baby02-2', name: 'BABY02-2', line: 'medicale', placement: 'pedestal', url: M + 'pesaneonati/1020-baby-02-2.html', approx: { w: 56, d: 45, h: 15 }, pedestalHeight: 85 },
  ht: { id: 'ht', name: 'HT', line: 'medicale', placement: 'pedestal', url: M + 'laboratorio/1025-ht.html', approx: { w: 28, d: 35, h: 32 }, pedestalHeight: 95 },

  // ---- Industriale ----
  'wp4-1212': { id: 'wp4-1212', name: 'WP4 1212 + WX', line: 'industriale', placement: 'floor', url: I + 'piattaforme-4-celle/154-wp4.html', approx: { w: 165, d: 120, h: 115 } },
  'wp4-u': { id: 'wp4-u', name: 'WP4-U', line: 'industriale', placement: 'floor', url: I + 'piattaforme-4-celle/155-wp4-u.html', approx: { w: 105, d: 125, h: 30 } },
  'tpx-c': { id: 'tpx-c', name: 'TPX-C', line: 'industriale', placement: 'floor', url: I + 'transpallet-pesatori/1396-tpx-c.html', approx: { w: 55, d: 165, h: 125 } },
  'wx-wpa': { id: 'wx-wpa', name: 'WX + WPA', line: 'industriale', placement: 'floor', url: I + 'piattaforme-con-indicatore/233-indicatore-wx-con-piattaforma-wpa.html', approx: { w: 45, d: 60, h: 120 } },
  cx: { id: 'cx', name: 'DINAMOMETRO CX', line: 'industriale', placement: 'floor', url: I + 'dinamometri/161-dinamometro-cx.html', approx: { w: 195, d: 40, h: 240 } },
  'jsd-dual': { id: 'jsd-dual', name: 'JSD DUAL', line: 'industriale', placement: 'pedestal', url: I + 'dual-platform/129-jsd-dual.html', approx: { w: 66, d: 35, h: 14 }, pedestalHeight: 85 },
  smart: { id: 'smart', name: 'SMART', line: 'industriale', placement: 'pedestal', url: I + 'retail/1555-smart.html', approx: { w: 36, d: 40, h: 58 }, pedestalHeight: 85 },
  jpp: { id: 'jpp', name: 'JPP', line: 'industriale', placement: 'pedestal', url: I + 'stampante-integrata/126-jpp.html', approx: { w: 38, d: 40, h: 62 }, pedestalHeight: 85 },
  wj600: { id: 'wj600', name: 'WJ 600', line: 'industriale', placement: 'pedestal', url: I + 'precisione/108-wj.html', approx: { w: 20, d: 23, h: 9 }, pedestalHeight: 95 },
  nhb: { id: 'nhb', name: 'NHB', line: 'industriale', placement: 'pedestal', url: I + 'precisione/110-nhb.html', approx: { w: 20, d: 25, h: 9 }, pedestalHeight: 95 },

  // ---- Design (all floor: the line has no table-top models) ----
  '960-bianca': { id: '960-bianca', name: '960 Bianca', line: 'design', placement: 'floor', url: D + '960/1-960-bianca.html', approx: { w: 27, d: 40, h: 20 } },
  '960-chrome': { id: '960-chrome', name: '960 Chrome', line: 'design', placement: 'floor', url: D + '960/3-960-chrome.html', approx: { w: 27, d: 40, h: 20 } },
  '960-glass': { id: '960-glass', name: '960 Glass', line: 'design', placement: 'floor', url: D + '960/4-960-glass.html', approx: { w: 27, d: 40, h: 20 } },
  '960-gold': { id: '960-gold', name: '960 Gold', line: 'design', placement: 'floor', url: D + '960/6-960-gold.html', approx: { w: 27, d: 40, h: 20 } },
  '960-tarsie': { id: '960-tarsie', name: '960 Tarsie', line: 'design', placement: 'floor', url: URLS.design, approx: { w: 27, d: 40, h: 20 } },
  'r150-bianca': { id: 'r150-bianca', name: 'R150 Bianca', line: 'design', placement: 'floor', url: D + 'r150-classiche/7-r150-bianca.html', approx: { w: 27, d: 40, h: 90 } },
  'r150-chrome': { id: 'r150-chrome', name: 'R150 Chrome', line: 'design', placement: 'floor', url: D + 'r150-classiche/8-r150-chrome.html', approx: { w: 27, d: 40, h: 90 } },
  'r150-glass': { id: 'r150-glass', name: 'R150 Glass', line: 'design', placement: 'floor', url: D + 'r150-classiche/9-r150-glass.html', approx: { w: 27, d: 40, h: 90 } },
  'r150-gold': { id: 'r150-gold', name: 'R150 Gold', line: 'design', placement: 'floor', url: D + 'r150-classiche/10-r150-gold.html', approx: { w: 27, d: 40, h: 90 } },
  'r150-tarsie': { id: 'r150-tarsie', name: 'R150 Tarsie Cromata', line: 'design', placement: 'floor', url: URLS.design, approx: { w: 27, d: 40, h: 90 } },
};

export const ALL_SCALE_IDS: ScaleId[] = [...SCALE_IDS.medicale, ...SCALE_IDS.industriale, ...SCALE_IDS.design];
