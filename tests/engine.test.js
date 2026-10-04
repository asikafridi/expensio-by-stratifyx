import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, computeSplit, SplitError } from '../server/engine/split.js';
import { netBalances, simplifyDebts, pairwiseDebts } from '../server/engine/debt.js';
import { toMinor, fromMinor, convertMinor, MoneyError } from '../server/engine/money.js';
import { summarize, profitShares } from '../server/engine/business.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);

test('allocate always reconciles exactly (fuzz)', () => {
  for (let n = 0; n < 2000; n++) {
    const total = Math.floor(Math.random() * 10_000_000);
    const k = 1 + Math.floor(Math.random() * 9);
    const w = Array.from({ length: k }, () => 1 + Math.floor(Math.random() * 1000));
    const r = allocate(total, w);
    assert.equal(sum(r), total);
    assert.ok(r.every((x) => x >= 0));
  }
});

test('allocate: 100.00 / 3 -> 3334,3333,3333 (deterministic)', () => {
  assert.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
});

test('money parsing is exact and strict', () => {
  assert.equal(toMinor('19.99', 'USD'), 1999);
  assert.equal(toMinor(0.1 + 0.2, 'USD'), 30);
  assert.equal(toMinor('500', 'JPY'), 500);
  assert.throws(() => toMinor('1.234', 'USD'), MoneyError);
  assert.throws(() => toMinor('abc', 'USD'), MoneyError);
  assert.equal(fromMinor(1999, 'USD'), 19.99);
  assert.equal(convertMinor(10000, 'USD', 'BDT', 122), 1220000);
});

test('equal split with multiple payers', () => {
  const r = computeSplit({
    totalMinor: 30000, baseTotalMinor: 30000, splitType: 'equal',
    participants: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }],
    payers: [{ userId: 'a', amountMinor: 20000 }, { userId: 'b', amountMinor: 10000 }],
  });
  assert.equal(sum(r.paid.map((x) => x.amountMinor)), 30000);
  assert.deepEqual(r.owed.map((x) => x.amountMinor), [10000, 10000, 10000]);
});

test('percent / shares / exact / validation', () => {
  const base = { totalMinor: 10000, baseTotalMinor: 10000, payers: [{ userId: 'a', amountMinor: 10000 }] };
  const pct = computeSplit({ ...base, splitType: 'percent', participants: [{ userId: 'a', value: 50 }, { userId: 'b', value: 30 }, { userId: 'c', value: 20 }] });
  assert.deepEqual(pct.owed.map((x) => x.amountMinor), [5000, 3000, 2000]);
  assert.throws(() => computeSplit({ ...base, splitType: 'percent', participants: [{ userId: 'a', value: 50 }, { userId: 'b', value: 30 }] }), SplitError);
  const sh = computeSplit({ ...base, splitType: 'shares', participants: [{ userId: 'a', value: 2 }, { userId: 'b', value: 1 }] });
  assert.equal(sum(sh.owed.map((x) => x.amountMinor)), 10000);
  assert.equal(sh.owed[0].amountMinor, 6667);
  const ex = computeSplit({ ...base, splitType: 'exact', participants: [{ userId: 'a', value: 7000 }, { userId: 'b', value: 3000 }] });
  assert.deepEqual(ex.owed.map((x) => x.amountMinor), [7000, 3000]);
  assert.throws(() => computeSplit({ ...base, splitType: 'exact', participants: [{ userId: 'a', value: 7000 }, { userId: 'b', value: 2000 }] }), SplitError);
  assert.throws(() => computeSplit({ ...base, payers: [{ userId: 'a', amountMinor: 9000 }], splitType: 'equal', participants: [{ userId: 'a' }] }), SplitError);
});

test('itemized bill spreads tax/tip proportionally and reconciles', () => {
  const r = computeSplit({
    totalMinor: 11000, baseTotalMinor: 11000, splitType: 'itemized',
    items: [
      { name: 'Pizza', amountMinor: 6000, assignees: ['a', 'b'] },
      { name: 'Salad', amountMinor: 4000, assignees: ['c'] },
    ], // 10000 of items + 1000 service charge
    payers: [{ userId: 'a', amountMinor: 11000 }],
  });
  const m = Object.fromEntries(r.owed.map((x) => [x.userId, x.amountMinor]));
  assert.equal(m.a, 3300); assert.equal(m.b, 3300); assert.equal(m.c, 4400);
  assert.equal(sum(Object.values(m)), 11000);
});

test('multi-currency: split uses converted base total and still reconciles', () => {
  const total = 3333; const base = convertMinor(total, 'USD', 'BDT', 122);
  const r = computeSplit({ totalMinor: total, baseTotalMinor: base, splitType: 'equal', participants: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }], payers: [{ userId: 'a', amountMinor: total }] });
  assert.equal(sum(r.owed.map((x) => x.amountMinor)), base);
});

test('balances, simplification and settlements', () => {
  const e1 = computeSplit({ totalMinor: 30000, baseTotalMinor: 30000, splitType: 'equal', participants: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }], payers: [{ userId: 'a', amountMinor: 30000 }] });
  const e2 = computeSplit({ totalMinor: 9000, baseTotalMinor: 9000, splitType: 'equal', participants: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }], payers: [{ userId: 'b', amountMinor: 9000 }] });
  const net = netBalances([e1, e2]);
  assert.equal(sum([...net.values()]), 0);
  const plan = simplifyDebts(net);
  assert.ok(plan.length <= 2);
  const applied = netBalances([e1, e2], plan);
  assert.ok([...applied.values()].every((v) => v === 0), 'plan fully settles the group');
  const pw = pairwiseDebts([e1, e2]);
  assert.equal(pw.find((x) => x.from === 'c' && x.to === 'a').amountMinor, 10000);
  assert.equal(pw.find((x) => x.from === 'c' && x.to === 'b').amountMinor, 3000);
  const after = pairwiseDebts([e1, e2], [{ from: 'c', to: 'a', amountMinor: 10000 }]);
  assert.ok(!after.find((x) => x.from === 'c' && x.to === 'a'));
});

test('simplify: chain a->b->c collapses to a->c', () => {
  const plan = simplifyDebts(new Map([['a', -100], ['b', 0], ['c', 100]]));
  assert.deepEqual(plan, [{ from: 'a', to: 'c', amountMinor: 100 }]);
});

test('business summary & profit shares', () => {
  const s = summarize([
    { type: 'investment', amountMinor: 100000, partner: 'a' }, { type: 'investment', amountMinor: 50000, partner: 'b' },
    { type: 'profit', amountMinor: 40000, partner: 'a' }, { type: 'expense', amountMinor: 10001, partner: 'b' },
    { type: 'profit', amountMinor: 999, partner: 'b', voidedAt: new Date() },
  ]);
  assert.equal(s.netProfit, 29999);
  const sh = profitShares(s.netProfit, [{ user: 'a', ownershipBps: 6667 }, { user: 'b', ownershipBps: 3333 }]);
  assert.equal(sum(sh.map((x) => x.amountMinor)), 29999);
});
