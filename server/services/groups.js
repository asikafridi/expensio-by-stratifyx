import mongoose from 'mongoose';
import { Group, Expense, Settlement, User } from '../models/index.js';
import { forbidden, notFound, badRequest } from '../lib/errors.js';
import { computeSplit, SplitError } from '../engine/split.js';
import { toMinor, convertMinor, isCurrency, CURRENCIES } from '../engine/money.js';
import { getRate } from '../engine/fx.js';
import { netBalances, simplifyDebts, pairwiseDebts } from '../engine/debt.js';

export async function loadGroup(id, userId, { adminOnly = false, allowArchived = true } = {}) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Group not found');
  const g = await Group.findById(id);
  if (!g) throw notFound('Group not found');
  const me = g.members.find((m) => String(m.user) === String(userId) && m.active);
  if (!me) throw forbidden('You are not a member of this group');
  if (adminOnly && me.role !== 'admin') throw forbidden('Only group admins can do that');
  if (!allowArchived && g.status === 'archived') throw badRequest('This group is archived (read-only)');
  return { g, me };
}
export const activeIds = (g) => g.members.filter((m) => m.active).map((m) => String(m.user));

/** Validates a client payload and runs it through the calculation engine → persistable expense fields. */
export function buildExpense(group, p, actorId) {
  const cur = p.currency || group.baseCurrency;
  if (!isCurrency(cur)) throw new SplitError('Unsupported currency');
  const members = new Set(activeIds(group));
  const inGroup = (id) => { if (!members.has(String(id))) throw new SplitError('Everyone in a split must be an active group member'); return String(id); };
  let totalMinor;
  try { totalMinor = toMinor(p.amount, cur); } catch (e) { throw new SplitError(e.message); }

  const payers = (p.payers?.length ? p.payers : [{ userId: actorId, amount: p.amount }])
    .map((x) => ({ userId: inGroup(x.userId), amountMinor: toMinor(x.amount, cur) }));
  const participants = (p.participants || []).map((x) => ({
    userId: inGroup(x.userId),
    value: p.splitType === 'exact' ? toMinor(x.value ?? 0, cur) : x.value,
  }));
  const items = (p.items || []).map((it) => ({ name: it.name, amountMinor: toMinor(it.amount, cur), assignees: it.assignees.map(inGroup) }));

  const rate = cur === group.baseCurrency ? 1 : Number(p.fxRate) || getRate(cur, group.baseCurrency);
  const baseTotalMinor = convertMinor(totalMinor, cur, group.baseCurrency, rate);
  const { owed, paid } = computeSplit({ totalMinor, baseTotalMinor, splitType: p.splitType, participants, items, payers });
  return {
    title: p.title, category: p.category || 'general', note: p.note || '', date: p.date ? new Date(p.date) : new Date(),
    currency: cur, amountMinor: totalMinor, fxRate: rate, baseCurrency: group.baseCurrency, baseAmountMinor: baseTotalMinor,
    splitType: p.splitType,
    owed: owed.map((x) => ({ user: x.userId, amountMinor: x.amountMinor })),
    paid: paid.map((x) => ({ user: x.userId, amountMinor: x.amountMinor })),
    input: { participants: p.participants || [], items: p.items || [], payers: p.payers || [], amount: p.amount, fxRate: p.fxRate },
  };
}

const plain = (arr) => arr.map((x) => ({ userId: String(x.user), amountMinor: x.amountMinor }));
export async function groupBalances(group) {
  const [expenses, settlements, pending] = await Promise.all([
    Expense.find({ group: group._id, deletedAt: null }).select('paid owed').lean(),
    Settlement.find({ group: group._id, status: 'confirmed' }).select('from to amountMinor').lean(),
    Settlement.find({ group: group._id, status: 'pending' }).sort({ createdAt: -1 }).lean(),
  ]);
  const ex = expenses.map((e) => ({ paid: plain(e.paid), owed: plain(e.owed) }));
  const st = settlements.map((s) => ({ from: String(s.from), to: String(s.to), amountMinor: s.amountMinor }));
  const net = netBalances(ex, st);
  for (const id of activeIds(group)) if (!net.has(id)) net.set(id, 0);
  const plan = group.simplifyDebts ? simplifyDebts(net) : pairwiseDebts(ex, st);
  return {
    currency: group.baseCurrency, symbol: CURRENCIES[group.baseCurrency]?.symbol,
    net: [...net].map(([userId, amountMinor]) => ({ userId, amountMinor })),
    plan, pending,
    totalMinor: expenses.reduce((a, e) => a + e.owed.reduce((s, o) => s + o.amountMinor, 0), 0),
  };
}

export async function memberCards(group) {
  const ids = group.members.map((m) => m.user);
  const users = await User.find({ _id: { $in: ids } }).select('name email avatar mobileBanking emailVerified').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return group.members.map((m) => {
    const u = byId.get(String(m.user)) || {};
    return { id: String(m.user), role: m.role, active: m.active, name: u.name || 'Unknown', email: u.email, avatar: u.avatar, banking: u.mobileBanking, joinedAt: m.joinedAt };
  });
}
