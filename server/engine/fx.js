/**
 * Indicative FX table (units per 1 USD). These are placeholders so multi-currency
 * works out of the box. In production set FX_RATES_JSON or feed a live provider
 * into `setRates()` from a scheduled job. Users may always override the rate when
 * entering an expense, and the rate used is stored on the expense for auditability.
 */
import { isCurrency } from './money.js';

const perUsd = {
  USD: 1, BDT: 122, EUR: 0.92, GBP: 0.78, INR: 84, AED: 3.6725, SAR: 3.75,
  MYR: 4.4, SGD: 1.34, CAD: 1.36, AUD: 1.5, JPY: 150,
};

export function setRates(next) {
  for (const [k, v] of Object.entries(next || {})) if (isCurrency(k) && Number(v) > 0) perUsd[k] = Number(v);
}
export const getRates = () => ({ ...perUsd });

export function getRate(from, to) {
  if (from === to) return 1;
  if (!perUsd[from] || !perUsd[to]) throw new Error(`No FX rate for ${from}->${to}`);
  return Number((perUsd[to] / perUsd[from]).toPrecision(8));
}
