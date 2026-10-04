/**
 * Money primitives. All amounts are stored and computed as INTEGER minor units
 * (e.g. paisa / cents) – never floats – so splits always reconcile exactly.
 */
export const CURRENCIES = {
  BDT: { name: 'Bangladeshi Taka', symbol: '৳', exp: 2 },
  USD: { name: 'US Dollar', symbol: '$', exp: 2 },
  EUR: { name: 'Euro', symbol: '€', exp: 2 },
  GBP: { name: 'British Pound', symbol: '£', exp: 2 },
  INR: { name: 'Indian Rupee', symbol: '₹', exp: 2 },
  AED: { name: 'UAE Dirham', symbol: 'د.إ', exp: 2 },
  SAR: { name: 'Saudi Riyal', symbol: '﷼', exp: 2 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', exp: 2 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', exp: 2 },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', exp: 2 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', exp: 2 },
  JPY: { name: 'Japanese Yen', symbol: '¥', exp: 0 },
};

export class MoneyError extends Error {
  constructor(message) { super(message); this.name = 'MoneyError'; this.status = 422; }
}

export const isCurrency = (c) => Object.prototype.hasOwnProperty.call(CURRENCIES, c);

/** "12.50" | 12.5 -> 1250. Rejects more decimals than the currency allows. */
export function toMinor(value, currency = 'BDT') {
  if (!isCurrency(currency)) throw new MoneyError(`Unsupported currency: ${currency}`);
  const { exp } = CURRENCIES[currency];
  // Numbers (from JS floats) are snapped to the currency precision; strings are validated strictly.
  const s = typeof value === 'number' && Number.isFinite(value) ? value.toFixed(exp) : String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new MoneyError('Invalid amount');
  const frac = s.split('.')[1] || '';
  if (frac.length > exp && /[1-9]/.test(frac.slice(exp))) throw new MoneyError(`${currency} supports at most ${exp} decimal places`);
  const n = Math.round(Number(s) * 10 ** exp);
  if (!Number.isSafeInteger(n)) throw new MoneyError('Amount too large');
  return n;
}

export function fromMinor(minor, currency = 'BDT') {
  const { exp } = CURRENCIES[currency] || CURRENCIES.BDT;
  return minor / 10 ** exp;
}

/** Convert minor units between currencies using a rate (1 `from` = rate `to`). */
export function convertMinor(minor, from, to, rate) {
  if (from === to) return minor;
  const fe = CURRENCIES[from].exp;
  const te = CURRENCIES[to].exp;
  return Math.round((minor / 10 ** fe) * rate * 10 ** te);
}
