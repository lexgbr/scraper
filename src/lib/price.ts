export type Money = { amount: number; currency: 'GBP' };

const GBP_MARKERS = ['£', 'GBP', 'gbp', 'pounds', 'pound'];
export function ensureGBP(text: string) {
  const t = text.toLowerCase();
  return GBP_MARKERS.some(m => t.includes(m.toLowerCase()));
}

export function parsePriceToGBP(text: string): Money {
  ensureGBP(text);
  const cleaned = text.replace(/[^0-9,\.]/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (hasComma && !hasDot) normalized = cleaned.replace(',', '.');
  const val = Number.parseFloat(normalized);
  if (Number.isNaN(val)) throw new Error(`Cannot parse price from: ${text}`);
  return { amount: Number(val.toFixed(2)), currency: 'GBP' };
}

export function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}
