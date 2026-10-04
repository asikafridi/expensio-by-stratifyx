import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Group, Expense, Settlement, Invitation, User } from '../models/index.js';
import { authenticate, requireVerified } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, conflict, badRequest, notFound } from '../lib/errors.js';
import { isCurrency, CURRENCIES, fromMinor } from '../engine/money.js';
import { loadGroup, activeIds, groupBalances, memberCards } from '../services/groups.js';
import { sha256, randomToken } from '../lib/crypto.js';
import { sendMail } from '../lib/mailer.js';
import { T } from '../lib/emailTemplates.js';
import { notify } from '../services/notify.js';
import { strictLimiter } from '../middleware/security.js';
import { config } from '../config/env.js';
import { audit } from '../services/audit.js';

const r = Router();
r.use(authenticate);

const groupSchema = z.object({
  name: z.string().trim().min(2, 'Give your group a name').max(80),
  emoji: z.string().max(8).optional(),
  category: z.enum(['trip', 'home', 'event', 'friends', 'work', 'other']).optional(),
  description: z.string().max(300).optional(),
  destination: z.string().max(120).optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  baseCurrency: z.string().refine(isCurrency, 'Unsupported currency').optional(),
  simplifyDebts: z.boolean().optional(),
});

r.get('/', wrap(async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.user.id);
  const groups = await Group.find({ members: { $elemMatch: { user: me, active: true } } }).sort({ lastActivityAt: -1 }).limit(100).lean();
  const ids = groups.map((g) => g._id);
  const mine = (field) => ({ $sum: { $map: { input: { $filter: { input: `$${field}`, as: 'p', cond: { $eq: ['$$p.user', me] } } }, as: 'x', in: '$$x.amountMinor' } } });
  const [agg, sets] = await Promise.all([
    Expense.aggregate([
      { $match: { group: { $in: ids }, deletedAt: null } },
      { $project: { group: 1, p: mine('paid'), o: mine('owed'), t: { $sum: '$owed.amountMinor' } } },
      { $group: { _id: '$group', paid: { $sum: '$p' }, owed: { $sum: '$o' }, total: { $sum: '$t' }, count: { $sum: 1 } } },
    ]),
    Settlement.find({ group: { $in: ids }, status: 'confirmed', $or: [{ from: me }, { to: me }] }).select('group from to amountMinor').lean(),
  ]);
  const stat = new Map(agg.map((a) => [String(a._id), a]));
  const adj = new Map();
  for (const s of sets) adj.set(String(s.group), (adj.get(String(s.group)) || 0) + (String(s.from) === req.user.id ? s.amountMinor : -s.amountMinor));
  res.json({
    groups: groups.map((g) => {
      const s = stat.get(String(g._id)) || { paid: 0, owed: 0, total: 0, count: 0 };
      return { id: g._id, name: g.name, emoji: g.emoji, category: g.category, baseCurrency: g.baseCurrency, status: g.status, memberCount: g.members.filter((m) => m.active).length, expenseCount: s.count, totalMinor: s.total, myNetMinor: s.paid - s.owed + (adj.get(String(g._id)) || 0), lastActivityAt: g.lastActivityAt, startDate: g.startDate, endDate: g.endDate };
    }),
  });
}));

r.post('/', requireVerified, validate(groupSchema), wrap(async (req, res) => {
  if ((await Group.countDocuments({ createdBy: req.user.id, status: 'active' })) >= 50) throw conflict('You have reached the limit of 50 active groups', 'LIMIT');
  const b = req.body;
  const g = await Group.create({ ...b, baseCurrency: b.baseCurrency || req.user.baseCurrency || 'BDT', createdBy: req.user.id, members: [{ user: req.user.id, role: 'admin' }] });
  res.status(201).json({ id: g._id });
}));

r.get('/:id', wrap(async (req, res) => {
  const { g, me } = await loadGroup(req.params.id, req.user.id);
  const [members, balances, invites] = await Promise.all([
    memberCards(g), groupBalances(g),
    Invitation.find({ kind: 'group', target: g._id, status: 'pending', expiresAt: { $gt: new Date() } }).select('email createdAt expiresAt').lean(),
  ]);
  res.json({
    group: { id: g._id, name: g.name, emoji: g.emoji, category: g.category, description: g.description, destination: g.destination, startDate: g.startDate, endDate: g.endDate, baseCurrency: g.baseCurrency, symbol: CURRENCIES[g.baseCurrency]?.symbol, simplifyDebts: g.simplifyDebts, status: g.status, createdBy: g.createdBy },
    myRole: me.role, members, balances, invites,
  });
}));

r.patch('/:id', validate(groupSchema.partial().extend({ status: z.enum(['active', 'archived']).optional() })), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { adminOnly: true });
  const before = { name: g.name, status: g.status };
  const { baseCurrency, ...rest } = req.body;
  if (baseCurrency && baseCurrency !== g.baseCurrency) {
    if (await Expense.exists({ group: g._id, deletedAt: null })) throw conflict('Base currency can’t change after expenses exist', 'CURRENCY_LOCKED');
    g.baseCurrency = baseCurrency;
  }
  Object.assign(g, rest); await g.save();
  await audit(req, { action: 'group.updated', scope: `group:${g._id}`, entityType: 'group', entityId: g._id, before, after: rest });
  res.json({ ok: true });
}));

r.post('/:id/invite', strictLimiter, requireVerified, validate(z.object({ email: z.string().trim().toLowerCase().email().max(160) })), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { allowArchived: false });
  const email = req.body.email;
  if (email === req.user.email) throw badRequest('You are already in this group');
  const existing = await User.findOne({ email }).select('_id');
  if (existing && activeIds(g).includes(String(existing._id))) throw conflict('That person is already in the group');
  await Invitation.updateMany({ kind: 'group', target: g._id, email, status: 'pending' }, { status: 'revoked' });
  const token = randomToken(32);
  const inv = await Invitation.create({ kind: 'group', target: g._id, targetName: g.name, email, invitedBy: req.user.id, inviterName: req.user.name, role: 'member', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 864e5) });
  const m = T.invite({ inviter: req.user.name, kind: 'group', targetName: g.name, token, existing: Boolean(existing) });
  await sendMail({ to: email, subject: m.subject, html: m.html, devHint: `invite link: ${config.APP_URL}/#/invite/${token}` });
  if (existing) await notify(existing._id, { type: 'invite', category: 'invites', title: `${req.user.name} invited you to “${g.name}”`, body: 'Open your invitations to accept.', link: '/invitations' });
  await audit(req, { action: 'group.invited', scope: `group:${g._id}`, entityType: 'invitation', entityId: inv._id, after: { email } });
  res.status(201).json({ ok: true, invitationId: inv._id });
}));

r.delete('/:id/invites/:iid', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { adminOnly: true });
  await Invitation.updateOne({ _id: req.params.iid, kind: 'group', target: g._id, status: 'pending' }, { status: 'revoked' });
  res.json({ ok: true });
}));

r.delete('/:id/members/:userId', wrap(async (req, res) => {
  const { g, me } = await loadGroup(req.params.id, req.user.id);
  const target = req.params.userId;
  if (target !== req.user.id && me.role !== 'admin') throw conflict('Only admins can remove other members', 'FORBIDDEN');
  const m = g.members.find((x) => String(x.user) === target && x.active);
  if (!m) throw notFound('Member not found');
  const bal = (await groupBalances(g)).net.find((n) => n.userId === target);
  if (bal && bal.amountMinor !== 0) throw conflict('This member still has an unsettled balance. Settle up first.', 'UNSETTLED');
  if (m.role === 'admin' && g.members.filter((x) => x.active && x.role === 'admin').length === 1 && g.members.filter((x) => x.active).length > 1) throw conflict('Promote another admin before leaving', 'LAST_ADMIN');
  m.active = false; await g.save();
  await audit(req, { action: target === req.user.id ? 'group.left' : 'group.member_removed', scope: `group:${g._id}`, entityType: 'user', entityId: target });
  res.json({ ok: true });
}));

r.patch('/:id/members/:userId', validate(z.object({ role: z.enum(['admin', 'member']) })), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { adminOnly: true });
  const m = g.members.find((x) => String(x.user) === req.params.userId && x.active);
  if (!m) throw notFound('Member not found');
  m.role = req.body.role;
  if (!g.members.some((x) => x.active && x.role === 'admin')) throw conflict('A group needs at least one admin');
  await g.save(); res.json({ ok: true });
}));

r.get('/:id/balances', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  res.json({ balances: await groupBalances(g) });
}));

r.get('/:id/activity', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  const [ex, st, members] = await Promise.all([
    Expense.find({ group: g._id }).sort({ createdAt: -1 }).limit(25).select('title amountMinor currency createdBy createdAt deletedAt version').lean(),
    Settlement.find({ group: g._id }).sort({ createdAt: -1 }).limit(25).lean(), memberCards(g),
  ]);
  const name = (id) => members.find((m) => m.id === String(id))?.name || 'Someone';
  const events = [
    ...ex.map((e) => ({ type: e.deletedAt ? 'expense_deleted' : e.version > 1 ? 'expense_edited' : 'expense_added', at: e.deletedAt || e.createdAt, actor: name(e.createdBy), text: `${e.title}`, amountMinor: e.amountMinor, currency: e.currency })),
    ...st.map((s) => ({ type: `settlement_${s.status}`, at: s.respondedAt || s.createdAt, actor: name(s.from), text: `${name(s.from)} → ${name(s.to)}`, amountMinor: s.amountMinor, currency: g.baseCurrency })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
  res.json({ events });
}));

const csvCell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
r.get('/:id/export.csv', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  const members = await memberCards(g); const nm = (id) => members.find((m) => m.id === String(id))?.name || id;
  const [ex, st] = await Promise.all([Expense.find({ group: g._id, deletedAt: null }).sort({ date: 1 }).lean(), Settlement.find({ group: g._id, status: 'confirmed' }).sort({ createdAt: 1 }).lean()]);
  const rows = [['Type', 'Date', 'Title', 'Category', 'Currency', 'Amount', `Amount (${g.baseCurrency})`, 'Paid by', 'Split between', 'Split type']];
  for (const e of ex) rows.push(['Expense', e.date.toISOString().slice(0, 10), e.title, e.category, e.currency, fromMinor(e.amountMinor, e.currency), fromMinor(e.baseAmountMinor, g.baseCurrency), e.paid.map((p) => nm(p.user)).join('; '), e.owed.map((o) => `${nm(o.user)} ${fromMinor(o.amountMinor, g.baseCurrency)}`).join('; '), e.splitType]);
  for (const s of st) rows.push(['Settlement', s.createdAt.toISOString().slice(0, 10), `${nm(s.from)} paid ${nm(s.to)}`, s.method, g.baseCurrency, fromMinor(s.amountMinor, g.baseCurrency), fromMinor(s.amountMinor, g.baseCurrency), nm(s.from), nm(s.to), s.reference]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${g.name.replace(/[^\w-]+/g, '_')}-expensio.csv"`);
  res.send(`\uFEFF${rows.map((x) => x.map(csvCell).join(',')).join('\r\n')}`);
}));

export default r;
