import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Settlement, Notification, Group } from '../models/index.js';
import { authenticate, requireVerified } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, forbidden, notFound, badRequest, conflict } from '../lib/errors.js';
import { toMinor, fromMinor, CURRENCIES } from '../engine/money.js';
import { loadGroup, activeIds, groupBalances } from '../services/groups.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';

const r = Router();
r.use(authenticate);

const present = (s) => ({ id: s._id, groupId: s.group, from: String(s.from), to: String(s.to), amountMinor: s.amountMinor, method: s.method, reference: s.reference, note: s.note, status: s.status, createdBy: String(s.createdBy), createdAt: s.createdAt, respondedAt: s.respondedAt });
const fmt = (g, minor) => `${CURRENCIES[g.baseCurrency]?.symbol || ''}${fromMinor(minor, g.baseCurrency).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

r.get('/groups/:id/settlements', wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id);
  const rows = await Settlement.find({ group: g._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ settlements: rows.map(present) });
}));

const createSchema = z.object({
  from: z.string(), to: z.string(),
  amount: z.union([z.string(), z.number()]),
  method: z.enum(['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank', 'Cash', 'Other']).default('Cash'),
  reference: z.string().trim().max(60).optional(), note: z.string().trim().max(200).optional(),
});

/** Either party may record a payment; the OTHER party must approve it (two-step trust flow). */
r.post('/groups/:id/settlements', requireVerified, validate(createSchema), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { allowArchived: false });
  const { from, to } = req.body;
  const ids = activeIds(g);
  if (from === to || !ids.includes(from) || !ids.includes(to)) throw badRequest('Choose two different group members');
  if (req.user.id !== from && req.user.id !== to) throw forbidden('You can only record payments you are part of');
  const amountMinor = toMinor(req.body.amount, g.baseCurrency);
  if (amountMinor <= 0) throw badRequest('Amount must be greater than zero');
  const b = await groupBalances(g);
  const net = b.net.find((n) => n.userId === from)?.amountMinor || 0;
  const pendingOut = b.pending.filter((p) => String(p.from) === from).reduce((a, p) => a + p.amountMinor, 0);
  if (amountMinor > -net - pendingOut) throw conflict(`That is more than ${from === req.user.id ? 'you owe' : 'they owe'} right now`, 'OVERPAYMENT');
  const s = await Settlement.create({ group: g._id, from, to, amountMinor, currency: g.baseCurrency, method: req.body.method, reference: req.body.reference || '', note: req.body.note || '', createdBy: req.user.id });
  const other = req.user.id === from ? to : from;
  await notify(other, { type: 'settlement', category: 'settlements', email: true, title: `Payment to confirm in ${g.name}`, body: req.user.id === from ? `${req.user.name} says they paid you ${fmt(g, amountMinor)} via ${s.method}. Please confirm.` : `${req.user.name} says you paid them ${fmt(g, amountMinor)}. Please confirm.`, link: `/groups/${g._id}` });
  await Group.updateOne({ _id: g._id }, { lastActivityAt: new Date() });
  res.status(201).json({ settlement: present(s) });
}));

async function respond(req, res, status) {
  if (!mongoose.isValidObjectId(req.params.sid)) throw notFound('Settlement not found');
  const s0 = await Settlement.findById(req.params.sid).lean();
  if (!s0) throw notFound('Settlement not found');
  const { g } = await loadGroup(s0.group, req.user.id, { allowArchived: false });
  const isCreator = String(s0.createdBy) === req.user.id;
  const party = [String(s0.from), String(s0.to)].includes(req.user.id);
  if (!party) throw forbidden();
  if (status === 'cancelled' ? !isCreator : isCreator) throw forbidden(status === 'cancelled' ? 'Only the person who recorded it can cancel' : 'The other person must confirm or reject this payment');
  // Atomic state transition – protects against double-confirm and race conditions.
  const s = await Settlement.findOneAndUpdate({ _id: s0._id, status: 'pending' }, { status, respondedBy: req.user.id, respondedAt: new Date() }, { new: true });
  if (!s) throw conflict('This payment has already been handled', 'ALREADY_HANDLED');
  await audit(req, { action: `settlement.${status}`, scope: `group:${g._id}`, entityType: 'settlement', entityId: s._id, after: { amountMinor: s.amountMinor, from: s.from, to: s.to } });
  if (status !== 'cancelled') await notify(s.createdBy, { type: 'settlement', category: 'settlements', email: true, title: status === 'confirmed' ? `Payment confirmed in ${g.name} ✅` : `Payment declined in ${g.name}`, body: `${req.user.name} ${status === 'confirmed' ? 'confirmed' : 'declined'} the ${fmt(g, s.amountMinor)} payment.`, link: `/groups/${g._id}` });
  await Group.updateOne({ _id: g._id }, { lastActivityAt: new Date() });
  res.json({ settlement: present(s) });
}
r.post('/settlements/:sid/confirm', requireVerified, wrap((req, res) => respond(req, res, 'confirmed')));
r.post('/settlements/:sid/reject', requireVerified, wrap((req, res) => respond(req, res, 'rejected')));
r.post('/settlements/:sid/cancel', wrap((req, res) => respond(req, res, 'cancelled')));

r.post('/groups/:id/remind', requireVerified, validate(z.object({ userId: z.string() })), wrap(async (req, res) => {
  const { g } = await loadGroup(req.params.id, req.user.id, { allowArchived: false });
  if (!activeIds(g).includes(req.body.userId) || req.body.userId === req.user.id) throw badRequest('Pick another member');
  const link = `/groups/${g._id}`;
  const recent = await Notification.exists({ user: req.body.userId, type: 'reminder', link, createdAt: { $gt: new Date(Date.now() - 6 * 3600e3) } });
  if (recent) throw conflict('You already sent a reminder recently. Try again later.', 'TOO_SOON');
  await notify(req.body.userId, { type: 'reminder', category: 'settlements', email: true, title: `${req.user.name} sent a friendly reminder`, body: `You have an open balance in “${g.name}”. Settle up when you can 💸`, link });
  res.json({ ok: true });
}));

export default r;
