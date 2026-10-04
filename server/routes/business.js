import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Business, BusinessTxn, Invitation, NidRecord, User, AuditLog } from '../models/index.js';
import { authenticate, requireVerified } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, forbidden, notFound, badRequest, conflict } from '../lib/errors.js';
import { isCurrency, toMinor, fromMinor, CURRENCIES } from '../engine/money.js';
import { summarize, profitShares, TXN_TYPES } from '../engine/business.js';
import { sha256, randomToken } from '../lib/crypto.js';
import { sendMail } from '../lib/mailer.js';
import { T } from '../lib/emailTemplates.js';
import { config } from '../config/env.js';
import { nidSchema, submitNid } from '../services/kyc.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { flag } from '../services/settings.js';
import { strictLimiter } from '../middleware/security.js';

const r = Router();
r.use(authenticate);
r.use(wrap(async (_req, _res, next) => { if (!(await flag('businessModule'))) throw forbidden('The business module is currently unavailable'); next(); }));

const scope = (b) => `business:${b._id}`;
async function loadBiz(id, userId, { owner = false, writer = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Business not found');
  const b = await Business.findById(id);
  if (!b) throw notFound('Business not found');
  const me = b.partners.find((p) => String(p.user) === String(userId));
  if (!me) throw forbidden('You are not a partner in this business');
  if (owner && me.role !== 'owner') throw forbidden('Only business owners can do that');
  if (writer && !['owner', 'partner'].includes(me.role)) throw forbidden('Your role is view-only');
  if (b.status === 'closed' && (owner || writer)) throw conflict('This business is closed');
  return { b, me };
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name').max(100),
  type: z.enum(['partnership', 'sole', 'company', 'other']).default('partnership'),
  description: z.string().trim().max(500).optional().default(''),
  tradeLicense: z.string().trim().max(60).optional().default(''),
  currency: z.string().refine(isCurrency).default('BDT'),
  nid: nidSchema.optional(), // optional only when the user already has an identity record on file
});

async function partnerCards(b) {
  const ids = b.partners.map((p) => p.user);
  const [users, nids] = await Promise.all([User.find({ _id: { $in: ids } }).select('name email avatar').lean(), NidRecord.find({ user: { $in: ids } }).select('user status last4 nameOnNid').lean()]);
  const U = new Map(users.map((u) => [String(u._id), u])); const N = new Map(nids.map((n) => [String(n.user), n]));
  return b.partners.map((p) => ({ userId: String(p.user), name: U.get(String(p.user))?.name, email: U.get(String(p.user))?.email, avatar: U.get(String(p.user))?.avatar, role: p.role, ownershipPercent: p.ownershipBps / 100, ownershipBps: p.ownershipBps, joinedAt: p.joinedAt, identity: N.get(String(p.user)) ? { status: N.get(String(p.user)).status, masked: `••••••${N.get(String(p.user)).last4}` } : { status: 'missing' } }));
}

r.get('/', wrap(async (req, res) => {
  const list = await Business.find({ 'partners.user': req.user.id }).sort({ updatedAt: -1 }).lean();
  const sums = await BusinessTxn.find({ business: { $in: list.map((b) => b._id) }, voidedAt: null }).select('business type amountMinor partner').lean();
  const by = new Map();
  for (const t of sums) { const a = by.get(String(t.business)) || []; a.push(t); by.set(String(t.business), a); }
  res.json({ businesses: list.map((b) => { const s = summarize(by.get(String(b._id)) || []); const me = b.partners.find((p) => String(p.user) === req.user.id); return { id: b._id, name: b.name, type: b.type, currency: b.currency, status: b.status, myRole: me.role, myOwnershipPercent: me.ownershipBps / 100, partnerCount: b.partners.length, cashPositionMinor: s.cashPosition, netProfitMinor: s.netProfit, investmentMinor: s.investment }; }) });
}));

r.post('/', requireVerified, validate(createSchema), wrap(async (req, res) => {
  const u = await User.findById(req.user.id).select('twoFactorEnabled');
  if (!u.twoFactorEnabled) throw forbidden('Turn on two-factor authentication (Settings → Security) before creating a business.', 'TWO_FA_REQUIRED');
  if ((await Business.countDocuments({ createdBy: req.user.id, status: { $ne: 'closed' } })) >= 10) throw conflict('Business limit reached');
  const { nid, ...rest } = req.body;
  if (nid) await submitNid(req.user.id, nid);
  else if (!(await NidRecord.exists({ user: req.user.id }))) throw badRequest('NID details are required to create a business', 'NID_REQUIRED');
  const b = await Business.create({ ...rest, createdBy: req.user.id, partners: [{ user: req.user.id, role: 'owner', ownershipBps: 10000 }] });
  await audit(req, { action: 'business.created', scope: scope(b), entityType: 'business', entityId: b._id, after: { name: b.name } });
  res.status(201).json({ id: b._id });
}));

r.get('/:id', wrap(async (req, res) => {
  const { b, me } = await loadBiz(req.params.id, req.user.id);
  const [partners, txns, invites] = await Promise.all([
    partnerCards(b), BusinessTxn.find({ business: b._id }).select('type amountMinor partner voidedAt').lean(),
    me.role === 'owner' ? Invitation.find({ kind: 'business', target: b._id, status: 'pending', expiresAt: { $gt: new Date() } }).select('email role ownershipBps expiresAt').lean() : [],
  ]);
  const s = summarize(txns);
  res.json({
    business: { id: b._id, name: b.name, type: b.type, description: b.description, tradeLicense: b.tradeLicense, currency: b.currency, symbol: CURRENCIES[b.currency]?.symbol, status: b.status, flagReason: b.flagReason, createdAt: b.createdAt },
    myRole: me.role, partners, summary: s, profitShares: profitShares(s.netProfit, b.partners),
    invites: invites.map((i) => ({ id: i._id, email: i.email, role: i.role, ownershipPercent: i.ownershipBps / 100, expiresAt: i.expiresAt })),
  });
}));

r.patch('/:id', validate(z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500), tradeLicense: z.string().max(60) }).partial()), wrap(async (req, res) => {
  const { b } = await loadBiz(req.params.id, req.user.id, { owner: true });
  const before = { name: b.name, description: b.description, tradeLicense: b.tradeLicense };
  Object.assign(b, req.body); await b.save();
  await audit(req, { action: 'business.updated', scope: scope(b), entityType: 'business', entityId: b._id, before, after: req.body });
  res.json({ ok: true });
}));

r.post('/:id/invite', strictLimiter, validate(z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(['owner', 'partner', 'investor', 'accountant']).default('partner'), ownershipPercent: z.number().min(0).max(100).default(0) })), wrap(async (req, res) => {
  const { b, me } = await loadBiz(req.params.id, req.user.id, { owner: true });
  const { email, role } = req.body; const bps = Math.round(req.body.ownershipPercent * 100);
  if (email === req.user.email) throw badRequest('You are already a partner');
  if (['accountant'].includes(role) && bps > 0) throw badRequest('Accountants cannot hold ownership');
  const target = await User.findOne({ email }).select('_id');
  if (target && b.partners.some((p) => String(p.user) === String(target._id))) throw conflict('That person is already a partner');
  const pendingBps = (await Invitation.find({ kind: 'business', target: b._id, invitedBy: req.user.id, status: 'pending', expiresAt: { $gt: new Date() }, email: { $ne: email } }).select('ownershipBps').lean()).reduce((a, i) => a + i.ownershipBps, 0);
  if (bps + pendingBps > me.ownershipBps) throw conflict(`You only have ${(me.ownershipBps - pendingBps) / 100}% available to grant (including pending invitations).`, 'OWNERSHIP_EXCEEDED');
  await Invitation.updateMany({ kind: 'business', target: b._id, email, status: 'pending' }, { status: 'revoked' });
  const token = randomToken(32);
  const inv = await Invitation.create({ kind: 'business', target: b._id, targetName: b.name, email, invitedBy: req.user.id, inviterName: req.user.name, role, ownershipBps: bps, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 864e5) });
  const m = T.invite({ inviter: req.user.name, kind: 'business', targetName: b.name, role: `${role}${bps ? ` (${bps / 100}% share)` : ''}`, token, existing: Boolean(target) });
  await sendMail({ to: email, subject: m.subject, html: m.html, devHint: `business invite link: ${config.APP_URL}/#/invite/${token}` });
  if (target) await notify(target._id, { type: 'invite', category: 'invites', title: `${req.user.name} invited you to partner in “${b.name}”`, body: 'Review the invitation and verify your identity to join.', link: '/invitations' });
  await audit(req, { action: 'business.partner_invited', scope: scope(b), entityType: 'invitation', entityId: inv._id, after: { email, role, ownershipBps: bps } });
  res.status(201).json({ ok: true });
}));

r.delete('/:id/invites/:iid', wrap(async (req, res) => {
  const { b } = await loadBiz(req.params.id, req.user.id, { owner: true });
  await Invitation.updateOne({ _id: req.params.iid, kind: 'business', target: b._id, status: 'pending' }, { status: 'revoked' });
  await audit(req, { action: 'business.invite_revoked', scope: scope(b), entityType: 'invitation', entityId: req.params.iid });
  res.json({ ok: true });
}));

r.patch('/:id/partners/:uid', validate(z.object({ role: z.enum(['owner', 'partner', 'investor', 'accountant']).optional(), ownershipPercent: z.number().min(0).max(100).optional() })), wrap(async (req, res) => {
  const { b, me } = await loadBiz(req.params.id, req.user.id, { owner: true });
  const p = b.partners.find((x) => String(x.user) === req.params.uid);
  if (!p) throw notFound('Partner not found');
  const before = { role: p.role, ownershipBps: p.ownershipBps };
  if (req.body.ownershipPercent !== undefined) {
    if (String(p.user) === req.user.id) throw badRequest('Adjust your own share by changing your partners’ shares');
    const bps = Math.round(req.body.ownershipPercent * 100); const delta = bps - p.ownershipBps;
    if (me.ownershipBps - delta < 0) throw conflict('You don’t have enough ownership to give');
    me.ownershipBps -= delta; p.ownershipBps = bps; // ownership always sums to 100%
  }
  if (req.body.role) {
    if (p.role === 'owner' && req.body.role !== 'owner' && b.partners.filter((x) => x.role === 'owner').length === 1) throw conflict('A business needs at least one owner');
    p.role = req.body.role;
  }
  await b.save();
  await audit(req, { action: 'business.partner_updated', scope: scope(b), entityType: 'user', entityId: p.user, before, after: { role: p.role, ownershipBps: p.ownershipBps } });
  res.json({ ok: true });
}));

r.delete('/:id/partners/:uid', wrap(async (req, res) => {
  const { b, me } = await loadBiz(req.params.id, req.user.id);
  const self = req.params.uid === req.user.id;
  if (!self && me.role !== 'owner') throw forbidden('Only owners can remove partners');
  const p = b.partners.find((x) => String(x.user) === req.params.uid);
  if (!p) throw notFound('Partner not found');
  if (p.role === 'owner' && b.partners.filter((x) => x.role === 'owner').length === 1) throw conflict('The last owner cannot leave. Close the business instead.');
  const heir = b.partners.find((x) => x.role === 'owner' && String(x.user) !== req.params.uid);
  if (heir) heir.ownershipBps += p.ownershipBps;
  b.partners = b.partners.filter((x) => String(x.user) !== req.params.uid);
  await b.save();
  await audit(req, { action: self ? 'business.partner_left' : 'business.partner_removed', scope: scope(b), entityType: 'user', entityId: req.params.uid, before: { role: p.role, ownershipBps: p.ownershipBps } });
  res.json({ ok: true });
}));

// ---- Ledger (append-only; mistakes are voided, never edited) ----
const presentTxn = (t) => ({ id: t._id, type: t.type, amountMinor: t.amountMinor, partner: String(t.partner), category: t.category, note: t.note, date: t.date, createdBy: String(t.createdBy), voided: Boolean(t.voidedAt), voidReason: t.voidReason, createdAt: t.createdAt });
r.get('/:id/transactions', wrap(async (req, res) => {
  const { b } = await loadBiz(req.params.id, req.user.id);
  const q = { business: b._id }; if (TXN_TYPES.includes(req.query.type)) q.type = req.query.type;
  const page = Math.max(1, Number(req.query.page) || 1); const limit = 25;
  const [rows, total] = await Promise.all([BusinessTxn.find(q).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), BusinessTxn.countDocuments(q)]);
  res.json({ transactions: rows.map(presentTxn), total, pages: Math.ceil(total / limit) });
}));

r.post('/:id/transactions', requireVerified, validate(z.object({ type: z.enum(TXN_TYPES), amount: z.union([z.string(), z.number()]), partnerId: z.string().optional(), category: z.string().trim().max(40).optional(), note: z.string().trim().max(300).optional(), date: z.coerce.date().optional() })), wrap(async (req, res) => {
  const { b, me } = await loadBiz(req.params.id, req.user.id, { writer: true });
  const nid = await NidRecord.findOne({ user: req.user.id }).select('status').lean();
  if (!nid || nid.status === 'rejected') throw forbidden('Your identity must be on file (and not rejected) to record transactions.', 'NID_REQUIRED');
  if (b.status === 'flagged') throw conflict('This business is under review. Transactions are paused.', 'FLAGGED');
  let partner = req.user.id;
  if (req.body.partnerId && req.body.partnerId !== req.user.id) {
    if (me.role !== 'owner') throw forbidden('Only owners can record on behalf of others');
    if (!b.partners.some((p) => String(p.user) === req.body.partnerId)) throw badRequest('Unknown partner');
    partner = req.body.partnerId;
  }
  const amountMinor = toMinor(req.body.amount, b.currency);
  if (amountMinor <= 0) throw badRequest('Amount must be greater than zero');
  const t = await BusinessTxn.create({ business: b._id, partner, type: req.body.type, amountMinor, category: req.body.category || '', note: req.body.note || '', date: req.body.date || new Date(), createdBy: req.user.id });
  await Business.updateOne({ _id: b._id }, { updatedAt: new Date() });
  await audit(req, { action: 'business.txn_added', scope: scope(b), entityType: 'txn', entityId: t._id, after: { type: t.type, amountMinor, partner } });
  res.status(201).json({ transaction: presentTxn(t) });
}));

r.post('/:id/transactions/:tid/void', validate(z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(200) })), wrap(async (req, res) => {
  const { b, me } = await loadBiz(req.params.id, req.user.id, { writer: true });
  const t = await BusinessTxn.findOne({ _id: req.params.tid, business: b._id });
  if (!t) throw notFound('Transaction not found');
  if (t.voidedAt) throw conflict('Already voided');
  if (me.role !== 'owner' && String(t.createdBy) !== req.user.id) throw forbidden('Only owners or the creator can void this entry');
  t.voidedAt = new Date(); t.voidedBy = req.user.id; t.voidReason = req.body.reason; await t.save();
  await audit(req, { action: 'business.txn_voided', scope: scope(b), entityType: 'txn', entityId: t._id, before: { type: t.type, amountMinor: t.amountMinor }, after: { reason: req.body.reason } });
  res.json({ ok: true });
}));

r.get('/:id/audit', wrap(async (req, res) => {
  const { b } = await loadBiz(req.params.id, req.user.id, { owner: true });
  const rows = await AuditLog.find({ scope: scope(b) }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ events: rows.map((a) => ({ id: a._id, action: a.action, actor: a.actorEmail, at: a.createdAt, before: a.before, after: a.after })) });
}));

export default r;
