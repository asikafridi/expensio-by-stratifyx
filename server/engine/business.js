/** Business ledger maths (pure). */
import { allocate } from './split.js';

export const TXN_TYPES = ['investment', 'profit', 'expense', 'withdrawal'];

export function summarize(txns) {
  const t = { investment: 0, profit: 0, expense: 0, withdrawal: 0 };
  const byPartner = {};
  for (const x of txns) {
    if (x.voidedAt) continue;
    t[x.type] += x.amountMinor;
    const k = String(x.partner);
    byPartner[k] ||= { investment: 0, profit: 0, expense: 0, withdrawal: 0 };
    byPartner[k][x.type] += x.amountMinor;
  }
  const netProfit = t.profit - t.expense;
  return { ...t, netProfit, cashPosition: t.investment + netProfit - t.withdrawal, byPartner };
}

/** Split a net-profit figure across partners by ownership basis points (Σ = 10000). */
export function profitShares(netProfitMinor, partners) {
  const owners = partners.filter((p) => p.ownershipBps > 0);
  if (netProfitMinor <= 0 || !owners.length) return owners.map((p) => ({ userId: String(p.user), amountMinor: 0 }));
  const parts = allocate(netProfitMinor, owners.map((p) => p.ownershipBps));
  return owners.map((p, i) => ({ userId: String(p.user), amountMinor: parts[i] }));
}
