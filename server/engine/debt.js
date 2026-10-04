/**
 * Balance + debt-simplification engine (pure).
 * Balances are DERIVED from expenses + confirmed settlements – never stored –
 * so they cannot drift out of sync after edits, deletes or retries.
 */
import { allocate } from './split.js';

/** net[userId] > 0 means the group owes them; < 0 means they owe the group. */
export function netBalances(expenses, settlements = []) {
  const net = new Map();
  const add = (u, v) => net.set(String(u), (net.get(String(u)) || 0) + v);
  for (const e of expenses) {
    for (const p of e.paid) add(p.userId, p.amountMinor);
    for (const o of e.owed) add(o.userId, -o.amountMinor);
  }
  for (const s of settlements) { add(s.from, s.amountMinor); add(s.to, -s.amountMinor); }
  return net;
}

/** Cash-flow settlement plan: greedily matches biggest debtor with biggest creditor (≤ n-1 transfers). */
export function simplifyDebts(net) {
  const cred = []; const debt = [];
  for (const [u, v] of net) { if (v > 0) cred.push({ u, v }); else if (v < 0) debt.push({ u, v: -v }); }
  const out = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b.v - a.v); debt.sort((a, b) => b.v - a.v);
    const c = cred[0]; const d = debt[0];
    const amt = Math.min(c.v, d.v);
    out.push({ from: d.u, to: c.u, amountMinor: amt });
    c.v -= amt; d.v -= amt;
    if (c.v === 0) cred.shift();
    if (d.v === 0) debt.shift();
  }
  return out;
}

/** Who-owes-whom without simplification (each payer is repaid directly). */
export function pairwiseDebts(expenses, settlements = []) {
  const m = new Map(); // "a|b" with a<b : positive => a owes b, negative => b owes a
  const bump = (debtor, creditor, amt) => {
    if (debtor === creditor || !amt) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const k = `${a}|${b}`;
    m.set(k, (m.get(k) || 0) + (debtor === a ? amt : -amt));
  };
  for (const e of expenses) {
    const payerW = e.paid.map((p) => p.amountMinor);
    for (const o of e.owed) {
      const parts = allocate(o.amountMinor, payerW);
      e.paid.forEach((p, i) => bump(String(o.userId), String(p.userId), parts[i]));
    }
  }
  for (const s of settlements) bump(String(s.to), String(s.from), s.amountMinor); // a payment reduces the payer's debt
  const out = [];
  for (const [k, v] of m) {
    if (v === 0) continue;
    const [a, b] = k.split('|');
    out.push(v > 0 ? { from: a, to: b, amountMinor: v } : { from: b, to: a, amountMinor: -v });
  }
  return out;
}
