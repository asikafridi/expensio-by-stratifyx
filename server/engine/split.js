/**
 * Expensio calculation engine – PURE functions only (no DB, no I/O).
 *
 * Every split type reduces to one primitive: allocate(total, weights) using the
 * largest-remainder method, which guarantees Σ(result) === total exactly.
 */
export class SplitError extends Error {
  constructor(message) { super(message); this.name = 'SplitError'; this.status = 422; }
}

/** Largest-remainder allocation. weights: non-negative integers. Deterministic. */
export function allocate(totalMinor, weights) {
  if (!Number.isInteger(totalMinor) || totalMinor < 0) throw new SplitError('Total must be a non-negative integer');
  if (!weights.length) throw new SplitError('At least one participant is required');
  const W = weights.reduce((a, w) => a + BigInt(w), 0n);
  if (W <= 0n) throw new SplitError('Weights must sum to more than zero');
  const T = BigInt(totalMinor);
  const out = weights.map((w) => (T * BigInt(w)) / W);
  const rem = weights.map((w, i) => ({ i, r: (T * BigInt(w)) % W }));
  const left = Number(T - out.reduce((a, b) => a + b, 0n));
  rem.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; k < left; k++) out[rem[k].i] += 1n;
  return out.map(Number);
}

const uniq = (arr) => [...new Set(arr.map(String))];
const w1000 = (x) => Math.round(Number(x) * 1000);

/**
 * @param {object} p
 * @param {number} p.totalMinor        total in the expense's own currency
 * @param {number} p.baseTotalMinor    same total converted to the group's base currency
 * @param {string} p.splitType         equal | percent | shares | exact | itemized
 * @param {Array}  p.participants      [{userId, value?}]  (meaning of value depends on splitType)
 * @param {Array}  p.items             itemized: [{name, amountMinor, assignees:[userId]}]
 * @param {Array}  p.payers            [{userId, amountMinor}] in expense currency; must sum to total
 * @returns {{owed: Array<{userId,amountMinor}>, paid: Array<{userId,amountMinor}>}} in BASE currency
 */
export function computeSplit({ totalMinor, baseTotalMinor, splitType, participants = [], items = [], payers = [] }) {
  if (!(totalMinor > 0)) throw new SplitError('Amount must be greater than zero');
  if (!payers.length) throw new SplitError('At least one payer is required');
  const paySum = payers.reduce((a, p) => a + p.amountMinor, 0);
  if (paySum !== totalMinor) throw new SplitError('Payer amounts must add up to the expense total');
  if (uniq(payers.map((p) => p.userId)).length !== payers.length) throw new SplitError('Duplicate payer');

  let ids; let weights;
  switch (splitType) {
    case 'equal': {
      if (!participants.length) throw new SplitError('Select at least one participant');
      ids = participants.map((p) => String(p.userId)); weights = ids.map(() => 1);
      break;
    }
    case 'percent': {
      ids = participants.map((p) => String(p.userId));
      const pct = participants.map((p) => Number(p.value));
      if (pct.some((x) => !(x >= 0))) throw new SplitError('Invalid percentage');
      if (Math.abs(pct.reduce((a, b) => a + b, 0) - 100) > 0.005) throw new SplitError('Percentages must add up to 100%');
      weights = pct.map((x) => Math.round(x * 100));
      break;
    }
    case 'shares': {
      ids = participants.map((p) => String(p.userId));
      weights = participants.map((p) => w1000(p.value));
      if (weights.some((x) => !(x >= 0))) throw new SplitError('Invalid share value');
      break;
    }
    case 'exact': {
      ids = participants.map((p) => String(p.userId));
      weights = participants.map((p) => Math.round(Number(p.value)));
      if (weights.some((x) => !Number.isInteger(x) || x < 0)) throw new SplitError('Invalid exact amount');
      if (weights.reduce((a, b) => a + b, 0) !== totalMinor) throw new SplitError('Exact amounts must add up to the expense total');
      break;
    }
    case 'itemized': {
      if (!items.length) throw new SplitError('Add at least one item');
      const sub = new Map();
      let itemSum = 0;
      for (const it of items) {
        if (!(it.amountMinor > 0)) throw new SplitError(`Item "${it.name || ''}" needs an amount`);
        if (!it.assignees?.length) throw new SplitError(`Assign item "${it.name || ''}" to at least one person`);
        const parts = allocate(it.amountMinor, it.assignees.map(() => 1));
        it.assignees.forEach((u, i) => sub.set(String(u), (sub.get(String(u)) || 0) + parts[i]));
        itemSum += it.amountMinor;
      }
      if (itemSum > totalMinor) throw new SplitError('Items add up to more than the total');
      // Any remainder (tax, tip, service charge) is spread in proportion to each person's items.
      ids = [...sub.keys()]; weights = ids.map((u) => sub.get(u));
      break;
    }
    default: throw new SplitError('Unknown split type');
  }
  if (uniq(ids).length !== ids.length) throw new SplitError('Duplicate participant');
  if (!weights.some((x) => x > 0)) throw new SplitError('Nobody is responsible for this expense');

  const owedAmts = allocate(baseTotalMinor, weights);
  const paidAmts = allocate(baseTotalMinor, payers.map((p) => p.amountMinor));
  return {
    owed: ids.map((userId, i) => ({ userId, amountMinor: owedAmts[i] })).filter((x) => x.amountMinor > 0),
    paid: payers.map((p, i) => ({ userId: String(p.userId), amountMinor: paidAmts[i] })).filter((x) => x.amountMinor > 0),
  };
}
