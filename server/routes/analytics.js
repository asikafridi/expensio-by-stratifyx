import { Router } from 'express';
import mongoose from 'mongoose';
import { Expense, Group, Settlement, Invitation } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { wrap } from '../lib/errors.js';

const r = Router();
r.use(authenticate);

/** Dashboard + analytics in one call: balances, spend by category, 6-month trend, monthly recap. */
r.get('/overview', wrap(async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.user.id);
  const groups = await Group.find({ members: { $elemMatch: { user: me, active: true } } }).select('name emoji baseCurrency').lean();
  const ids = groups.map((g) => g._id);
  const since = new Date(); since.setUTCMonth(since.getUTCMonth() - 5, 1); since.setUTCHours(0, 0, 0, 0);
  const mineSum = (f) => ({ $sum: { $map: { input: { $filter: { input: `$${f}`, as: 'p', cond: { $eq: ['$$p.user', me] } } }, as: 'x', in: '$$x.amountMinor' } } });
  const [rows, sets, pendingToConfirm, invites] = await Promise.all([
    Expense.aggregate([
      { $match: { group: { $in: ids }, deletedAt: null, date: { $gte: since } } },
      { $project: { group: 1, category: 1, month: { $dateToString: { format: '%Y-%m', date: '$date' } }, owed: mineSum('owed'), paid: mineSum('paid'), cur: '$baseCurrency' } },
      { $group: { _id: { g: '$group', c: '$category', m: '$month', cur: '$cur' }, owed: { $sum: '$owed' }, paid: { $sum: '$paid' } } },
    ]),
    Settlement.countDocuments({ group: { $in: ids }, status: 'confirmed', $or: [{ from: me }, { to: me }] }),
    Settlement.find({ group: { $in: ids }, status: 'pending', createdBy: { $ne: me }, $or: [{ from: me }, { to: me }] }).select('group from to amountMinor').lean(),
    req.user.emailVerified ? Invitation.countDocuments({ email: req.user.email, status: 'pending', expiresAt: { $gt: new Date() } }) : 0,
  ]);
  // Per-currency totals so we never add BDT to USD.
  const byCur = {};
  const cur = (c) => (byCur[c] ||= { category: {}, month: {}, spent: 0 });
  for (const x of rows) { const c = cur(x._id.cur || 'BDT'); c.category[x._id.c] = (c.category[x._id.c] || 0) + x.owed; c.month[x._id.m] = (c.month[x._id.m] || 0) + x.owed; c.spent += x.owed; }
  const months = []; const d = new Date(since);
  for (let i = 0; i < 6; i++) { months.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  const thisMonth = months[5];
  const currencies = Object.keys(byCur);
  res.json({
    groupCount: groups.length, settledCount: sets, pendingConfirmations: pendingToConfirm.length, pendingInvites: invites, months,
    currencies: currencies.map((c) => {
      const o = byCur[c]; const top = Object.entries(o.category).sort((a, b) => b[1] - a[1])[0];
      return { currency: c, categories: Object.entries(o.category).map(([k, v]) => ({ category: k, amountMinor: v })).sort((a, b) => b.amountMinor - a.amountMinor), trend: months.map((m) => ({ month: m, amountMinor: o.month[m] || 0 })), spentThisMonthMinor: o.month[thisMonth] || 0, spent6mMinor: o.spent, topCategory: top ? top[0] : null };
    }),
  });
}));
export default r;
