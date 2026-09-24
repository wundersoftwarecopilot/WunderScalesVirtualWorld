/** Destinations for the clickable logos (tracking parameters removed). */
export const URLS = {
  corporate: 'https://www.wunder.it/',
  medicale: 'https://medicale.wunder.it/it/',
  industriale: 'https://industriale.wunder.it/it/',
  design: 'https://design.wunder.it/it/',
} as const;

export type Division = keyof typeof URLS;

/** Accessible names for the invisible links (read by screen readers only, never drawn). */
export const LABELS: Record<Division, string> = {
  corporate: 'Wunder Sa.Bi. — sito aziendale',
  medicale: 'Wunder Medicale — catalogo',
  industriale: 'Wunder Industriale — catalogo',
  design: 'Wunder Design — catalogo',
};
