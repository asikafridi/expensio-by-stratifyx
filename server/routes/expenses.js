import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Group, Expense, RecurringRule } from '../models/index.js';
import { authenticate, requireVerified } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, forbidden, notFound, badRequest } from '../lib/errors.js';
import { isCurrency } from '../engine/money.js';
import { loadGroup, buildExpense, memberCards } from '../services/groups.js';
import { notifyMany } from '../services/notify.js';
import { flag } from '../services/settings.js';
import { audit } from '../services/audit.js';

const r = Router();
r.use(authenticate);

export const CATEGORIES = ['general', 'food', 'groceries', 'transport', 'stay', 'travel', 'shopping', 'entertainment', 'bills', 'health', 'other'];
const money = z.union([z.string().trim().min(1), z.number()]);
export const expenseSchema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(120),
  amount: money.refine((v) => Number(v) > 0, 'Amount must be greater than zero'),
  currency: z.string().refine(isCurrency, 'Unsupported currency').optional(),
  fxRate: z.union([z.number(), z.string()]).optional().transform((v) => (v === undefined || v === '' ? undefined : Number(v))).refine((v) => v === undefined || v > 0, 'Invalid exchange rate'),
  category: z.enum(CATEGORIES).default('general'),
  note: z.string().max(500).optional(),
  date: z.coerce.date().optional(),
  splitType: z.enum(['equal', 'percent', 'shares', 'exact', 'itemized']).default('equal'),
  participants: z.array(z.object({ userId: z.string(), value: money.optional() })).max(100).default([]),
  items: z.array(z.object({ name: z.string().trim().max(80), amount: money, assignees: z.array(z.string()).min(1).max(100) })).max(100).default([]),
  payers: z.array(z.object({ userId: z.string(), amount: money })).max(20).default([]),
});

const present = (e, members) => ({
  id: e._id, groupId: e.group, title: e.title, category: e.category, note: e.note, date: e.date, currency: e.currency, amountMinor: e.amountMinor,
  fxRate: e.fxRate, baseCurrency: e.baseCurrency, baseAmountMinor: e.baseAmountMinor, splitType: e.splitType,
  paid: e.paid.map((p) => ({ userId: String(p.user), amountMinor: p.amountMinor })), owed: e.owed.map((p) => ({ userId: String(p.user), amountMinor: p.amountMinor })),
  createdBy: String(e.createdBy), version: e.version, recurring: Boolean(e.recurringRule), createdAt: e.createdAt, updatedAt: e.updatedAt,
  ...(members ? { names: Object.fromEntries(members.map((m) => [m.id, m.name])) } : {}),
});

r.get('/groups/:id/expenses', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(50, Number(req.query.limit) || 20);
  const q = { group: g._id, deletedAt: null };
  if (CATEGORIES.includes(req.query.category)) q.category = req.query.category;
  if (req.query.q) q.title = { $regex: String(req.query.q).slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [rows, total] = await Promise.all([Expense.find(q).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), Expense.countDocuments(q)]);
  res.json({ expenses: rows.map((e) => present(e)), total, page, pages: Math.ceil(total / limit) });
}));

// Live preview – runs the exact same engine as saving, persisting nothing.
r.post('/groups/:id/expenses/preview', validate(expenseSchema), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  const d = buildExpense(g, req.body, req.user.id);
  res.json({ baseCurrency: g.baseCurrency, fxRate: d.fxRate, baseAmountMinor: d.baseAmountMinor, owed: d.owed.map((o) => ({ userId: String(o.user), amountMinor: o.amountMinor })), paid: d.paid.map((o) => ({ userId: String(o.user), amountMinor: o.amountMinor })) });
}));

r.post('/groups/:id/expenses', requireVerified, validate(expenseSchema), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { allowArchived: false });
  const d = buildExpense(g, req.body, req.user.id);
  const e = await Expense.create({ ...d, group: g._id, createdBy: req.user.id });
  await Group.updateOne({ _id: g._id }, { lastActivityAt: new Date() });
  await notifyMany(d.owed.map((o) => o.user).filter((u) => String(u) !== req.user.id), { type: 'expense', category: 'activity', title: `New expense in ${g.name}`, body: `${req.user.name} added “${d.title}”.`, link: `/groups/${g._id}` });
  res.status(201).json({ expense: present(e) });
}));

r.get('/expenses/:eid', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.eid)) throw notFound('Expense not found');
  const e = await Expense.findById(req.params.eid).lean();
  if (!e || e.deletedAt) throw notFound('Expense not found');
  const { g } = await loadGroup(e.group, req.user.id);
  const members = await memberCards(g);
  res.json({ expense: { ...present(e, members), input: e.input, history: (e.history || []).map((h) => ({ version: h.version, at: h.at, by: String(h.by) })) } });
}));

async function ownExpense(req) {
  if (!mongoose.isValidObjectId(req.params.eid)) throw notFound('Expense not found');
  const e = await Expense.findById(req.params.eid);
  if (!e || e.deletedAt) throw notFound('Expense not found');
  const { g, me } = await loadGroup(e.group, req.user.id, { allowArchived: false });
  if (String(e.createdBy) !== req.user.id && me.role !== 'admin') throw forbidden('Only the creator or a group admin can change this expense');
  return { e, g };
}

r.put('/expenses/:eid', requireVerified, validate(expenseSchema), wrap(async (req, res) => {
  const { e, g } = await ownExpense(req);
  const d = buildExpense(g, req.body, req.user.id);
  const snapshot = { title: e.title, amountMinor: e.amountMinor, currency: e.currency, baseAmountMinor: e.baseAmountMinor, splitType: e.splitType, paid: e.paid, owed: e.owed };
  e.history.push({ version: e.version, at: new Date(), by: req.user.id, snapshot });
  if (e.history.length > 20) e.history.shift();
  Object.assign(e, d, { version: e.version + 1 });
  await e.save();
  await Group.updateOne({ _id: g._id }, { lastActivityAt: new Date() });
  await audit(req, { action: 'expense.edited', scope: `group:${g._id}`, entityType: 'expense', entityId: e._id, before: snapshot, after: { title: e.title, amountMinor: e.amountMinor } });
  await notifyMany(e.owed.map((o) => o.user).filter((u) => String(u) !== req.user.id), { type: 'expense', category: 'activity', title: `Expense updated in ${g.name}`, body: `${req.user.name} edited “${e.title}”. Balances were recalculated.`, link: `/groups/${g._id}` });
  res.json({ expense: present(e) });
}));

r.delete('/expenses/:eid', requireVerified, wrap(async (req, res) => {
  const { e, g } = await ownExpense(req);
  e.deletedAt = new Date(); e.deletedBy = req.user.id; await e.save(); // soft delete → balances recompute instantly
  await Group.updateOne({ _id: g._id }, { lastActivityAt: new Date() });
  await audit(req, { action: 'expense.deleted', scope: `group:${g._id}`, entityType: 'expense', entityId: e._id, before: { title: e.title, amountMinor: e.amountMinor } });
  res.json({ ok: true });
}));

// ---- Recurring expenses ----
r.get('/groups/:id/recurring', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  const rules = await RecurringRule.find({ group: g._id, active: true }).sort({ nextRunAt: 1 }).lean();
  res.json({ rules: rules.map((x) => ({ id: x._id, title: x.payload?.title, amount: x.payload?.amount, currency: x.payload?.currency || g.baseCurrency, frequency: x.frequency, nextRunAt: x.nextRunAt, runCount: x.runCount, createdBy: String(x.createdBy) })) });
}));
r.post('/groups/:id/recurring', requireVerified, validate(z.object({ expense: expenseSchema, frequency: z.enum(['weekly', 'monthly', 'yearly']), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() })), wrap(async (req, res) => {
  if (!(await flag('recurringExpenses'))) throw badRequest('Recurring expenses are not available right now');
  const { g } = await loadGroup(req.params.id, req.user.id, { allowArchived: false });
  buildExpense(g, req.body.expense, req.user.id); // validate now so bad rules never get stored
  const count = await RecurringRule.countDocuments({ group: g._id, active: true });
  if (count >= 20) throw badRequest('A group can have at most 20 recurring expenses');
  const first = req.body.startDate || new Date();
  const rule = await RecurringRule.create({ group: g._id, createdBy: req.user.id, payload: { ...req.body.expense, date: undefined }, frequency: req.body.frequency, nextRunAt: first, endAt: req.body.endDate });
  res.status(201).json({ id: rule._id });
}));
r.delete('/recurring/:rid', wrap(async (req, res) => {
  const rule = await RecurringRule.findById(req.params.rid);
  if (!rule) throw notFound('Rule not found');
  const { me } = await loadGroup(rule.group, req.user.id);
  if (String(rule.createdBy) !== req.user.id && me.role !== 'admin') throw forbidden();
  rule.active = false; await rule.save(); res.json({ ok: true });
}));

export default r;
