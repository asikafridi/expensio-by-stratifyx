import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Session, Group, Expense, Business, BusinessTxn, NidRecord, Ticket, Content, FeatureFlag, Setting, AuditLog, Notification, RecurringRule, STAFF_ROLES } from '../models/index.js';
import { authenticate, requireStaff, requirePerm, PERMS } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, badRequest, forbidden, notFound, unauthorized, conflict } from '../lib/errors.js';
import { decrypt } from '../lib/crypto.js';
import { sendMail, verifyMailer } from '../lib/mailer.js';
import { T } from '../lib/emailTemplates.js';
import { summarize } from '../engine/business.js';
import { revokeAll } from '../services/tokens.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { bust } from '../services/settings.js';
import { authLimiter } from '../middleware/security.js';

const r = Router();
r.use(authenticate, requireStaff);
const esc = (s) => String(s).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const paging = (req) => { const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(50, Number(req.query.limit) || 20); return { page, limit, skip: (page - 1) * limit }; };

r.get('/me', (req, res) => res.json({ role: req.user.role, perms: PERMS[req.user.role] }));

r.get('/overview', requirePerm('overview'), wrap(async (_req, res) => {
  const day = new Date(Date.now() - 864e5); const week = new Date(Date.now() - 7 * 864e5); const since14 = new Date(Date.now() - 14 * 864e5);
  const [users, verified, newToday, active7, groups, expenses, vol, kycPending, ticketsOpen, businesses, flagged, signups] = await Promise.all([
    User.countDocuments(), User.countDocuments({ emailVerified: true }), User.countDocuments({ createdAt: { $gt: day } }), User.countDocuments({ lastLoginAt: { $gt: week } }),
    Group.countDocuments(), Expense.countDocuments({ deletedAt: null }),
    Expense.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$baseCurrency', total: { $sum: '$baseAmountMinor' } } }]),
    NidRecord.countDocuments({ status: 'pending' }), Ticket.countDocuments({ status: { $ne: 'resolved' } }), Business.countDocuments(), Business.countDocuments({ status: 'flagged' }),
    User.aggregate([{ $match: { createdAt: { $gte: since14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  res.json({ kpis: { users, verified, verifiedRate: users ? Math.round((verified / users) * 100) : 0, newToday, active7, groups, expenses, volume: vol.map((v) => ({ currency: v._id, totalMinor: v.total })), kycPending, ticketsOpen, businesses, flagged }, signups });
}));

// ---------------- Users ----------------
r.get('/users', requirePerm('users:read'), wrap(async (req, res) => {
  const { skip, limit, page } = paging(req); const q = {};
  if (req.query.q) q.$or = [{ name: { $regex: esc(req.query.q), $options: 'i' } }, { email: { $regex: esc(req.query.q), $options: 'i' } }];
  if (req.query.role) q.role = String(req.query.role); if (req.query.status) q.status = String(req.query.status);
  const [rows, total] = await Promise.all([User.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).select('name email role status emailVerified twoFactorEnabled createdAt lastLoginAt lastLoginIp').lean(), User.countDocuments(q)]);
  res.json({ users: rows.map((u) => ({ id: u._id, ...u, _id: undefined })), total, page, pages: Math.ceil(total / limit) });
}));
r.get('/users/:id', requirePerm('users:read'), wrap(async (req, res) => {
  const u = await User.findById(req.params.id).select('-passwordHash -verify -reset -otp').lean();
  if (!u) throw notFound('User not found');
  const [groups, sessions, kyc, logins] = await Promise.all([Group.countDocuments({ 'members.user': u._id }), Session.countDocuments({ user: u._id, revokedAt: null, expiresAt: { $gt: new Date() } }), NidRecord.findOne({ user: u._id }).select('status last4 nameOnNid').lean(), AuditLog.find({ actor: u._id }).sort({ createdAt: -1 }).limit(15).select('action ip createdAt').lean()]);
  res.json({ user: { ...u, id: u._id }, groups, sessions, kyc, activity: logins });
}));
r.patch('/users/:id', requirePerm('users'), validate(z.object({ role: z.enum(['user', ...STAFF_ROLES]).optional(), status: z.enum(['active', 'disabled']).optional() })), wrap(async (req, res) => {
  if (req.user.role !== 'super_admin') throw forbidden('Only Super Admins can change roles or status');
  if (req.params.id === req.user.id) throw badRequest('You cannot change your own role or status');
  const u = await User.findById(req.params.id); if (!u) throw notFound('User not found');
  const before = { role: u.role, status: u.status };
  if (req.body.role) { u.role = req.body.role; if (STAFF_ROLES.includes(u.role)) { if (!u.emailVerified) throw conflict('Staff accounts must have a verified email'); u.twoFactorEnabled = true; } }
  if (req.body.status) u.status = req.body.status;
  if (req.body.status === 'disabled' || req.body.role) { u.tokenVersion += 1; await revokeAll(u._id); }
  await u.save();
  await audit(req, { action: 'admin.user_updated', entityType: 'user', entityId: u._id, before, after: { role: u.role, status: u.status } });
  res.json({ ok: true });
}));
r.post('/users/:id/force-logout', requirePerm('users'), wrap(async (req, res) => {
  await User.updateOne({ _id: req.params.id }, { $inc: { tokenVersion: 1 } }); await revokeAll(req.params.id);
  await audit(req, { action: 'admin.force_logout', entityType: 'user', entityId: req.params.id }); res.json({ ok: true });
}));

// ---------------- KYC / NID review ----------------
r.get('/kyc', requirePerm('kyc'), wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = await NidRecord.find({ status }).sort({ submittedAt: 1 }).limit(100).populate('user', 'name email').lean();
  res.json({ items: rows.map((n) => ({ id: n._id, user: n.user && { id: n.user._id, name: n.user.name, email: n.user.email }, masked: `••••••${n.last4}`, nameOnNid: n.nameOnNid, dob: n.dob, fatherName: n.fatherName, address: n.address, status: n.status, reason: n.reason, submittedAt: n.submittedAt, nameMatches: n.user ? n.user.name.trim().toLowerCase() === n.nameOnNid.trim().toLowerCase() : false })) });
}));
// Full NID number is only ever shown after password re-authentication, and every reveal is audited.
r.post('/kyc/:id/reveal', requirePerm('kyc'), authLimiter, validate(z.object({ password: z.string().min(1) })), wrap(async (req, res) => {
  const me = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.password, me.passwordHash))) throw unauthorized('Password is incorrect', 'BAD_CREDENTIALS');
  const n = await NidRecord.findById(req.params.id); if (!n) throw notFound('Record not found');
  await audit(req, { action: 'kyc.revealed', entityType: 'nid', entityId: n._id, after: { subject: String(n.user) } });
  res.json({ nidNumber: decrypt(n.box) });
}));
r.post('/kyc/:id/decision', requirePerm('kyc'), validate(z.object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(300).optional() }).refine((d) => d.decision === 'approve' || (d.reason && d.reason.length >= 5), { message: 'A reason is required when rejecting', path: ['reason'] })), wrap(async (req, res) => {
  const n = await NidRecord.findById(req.params.id); if (!n) throw notFound('Record not found');
  if (n.status !== 'pending') throw conflict('This submission was already reviewed');
  const before = n.status;
  n.status = req.body.decision === 'approve' ? 'approved' : 'rejected'; n.reason = req.body.reason; n.reviewedBy = req.user.id; n.reviewedAt = new Date(); await n.save();
  await audit(req, { action: `kyc.${n.status}`, entityType: 'nid', entityId: n._id, before: { status: before }, after: { status: n.status, reason: n.reason } });
  await notify(n.user, { type: 'kyc', category: 'activity', email: true, title: n.status === 'approved' ? 'Identity verified ✅' : 'Identity needs attention', body: n.status === 'approved' ? 'Your NID was verified. You are all set for business features.' : `Your NID submission was not approved: ${n.reason}. Please resubmit in Settings → Identity.`, link: '/settings' });
  res.json({ ok: true });
}));

// ---------------- Businesses ----------------
r.get('/businesses', requirePerm('businesses:read'), wrap(async (req, res) => {
  const { skip, limit } = paging(req); const q = req.query.q ? { name: { $regex: esc(req.query.q), $options: 'i' } } : {};
  if (req.query.status) q.status = String(req.query.status);
  const [rows, total] = await Promise.all([Business.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Business.countDocuments(q)]);
  res.json({ businesses: rows.map((b) => ({ id: b._id, name: b.name, type: b.type, status: b.status, partners: b.partners.length, currency: b.currency, createdAt: b.createdAt, flagReason: b.flagReason })), total });
}));
r.get('/businesses/:id', requirePerm('businesses:read'), wrap(async (req, res) => {
  const b = await Business.findById(req.params.id).lean(); if (!b) throw notFound('Business not found');
  const [users, nids, txns, events] = await Promise.all([User.find({ _id: { $in: b.partners.map((p) => p.user) } }).select('name email').lean(), NidRecord.find({ user: { $in: b.partners.map((p) => p.user) } }).select('user status').lean(), BusinessTxn.find({ business: b._id }).lean(), AuditLog.find({ scope: `business:${b._id}` }).sort({ createdAt: -1 }).limit(30).select('action actorEmail createdAt').lean()]);
  res.json({ business: { id: b._id, name: b.name, status: b.status, flagReason: b.flagReason, currency: b.currency, type: b.type, tradeLicense: b.tradeLicense }, partners: b.partners.map((p) => ({ role: p.role, ownershipPercent: p.ownershipBps / 100, name: users.find((u) => String(u._id) === String(p.user))?.name, email: users.find((u) => String(u._id) === String(p.user))?.email, identity: nids.find((n) => String(n.user) === String(p.user))?.status || 'missing' })), summary: { ...summarize(txns), byPartner: undefined }, events });
}));
r.post('/businesses/:id/flag', requirePerm('businesses'), validate(z.object({ flagged: z.boolean(), reason: z.string().trim().max(300).optional() })), wrap(async (req, res) => {
  const b = await Business.findById(req.params.id); if (!b) throw notFound('Business not found');
  const before = { status: b.status };
  b.status = req.body.flagged ? 'flagged' : 'active'; b.flagReason = req.body.flagged ? req.body.reason || 'Under review' : undefined; await b.save();
  await audit(req, { action: req.body.flagged ? 'admin.business_flagged' : 'admin.business_unflagged', scope: `business:${b._id}`, entityType: 'business', entityId: b._id, before, after: { status: b.status, reason: b.flagReason } });
  res.json({ ok: true });
}));

// ---------------- Support ----------------
r.get('/tickets', requirePerm('tickets'), wrap(async (req, res) => {
  const q = ['open', 'pending', 'resolved'].includes(req.query.status) ? { status: req.query.status } : {};
  const rows = await Ticket.find(q).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ tickets: rows.map((t) => ({ id: t._id, ref: t.ref, name: t.name, email: t.email, subject: t.subject, category: t.category, status: t.status, priority: t.priority, assignee: t.assignee, updatedAt: t.updatedAt, messages: t.messages })) });
}));
r.post('/tickets/:id/reply', requirePerm('tickets'), validate(z.object({ message: z.string().trim().min(1).max(4000).optional(), status: z.enum(['open', 'pending', 'resolved']).optional(), assignToMe: z.boolean().optional() })), wrap(async (req, res) => {
  const t = await Ticket.findById(req.params.id); if (!t) throw notFound('Ticket not found');
  if (req.body.message) {
    t.messages.push({ from: 'staff', author: 'Expensio Support', body: req.body.message }); t.status = req.body.status || 'pending';
    sendMail({ to: t.email, subject: `Re: ${t.subject} [#${t.ref}]`, html: T.notify({ name: t.name, title: `Update on your request #${t.ref}`, body: req.body.message }).html });
  } else if (req.body.status) t.status = req.body.status;
  if (req.body.assignToMe) t.assignee = req.user.id;
  await t.save();
  await audit(req, { action: 'admin.ticket_updated', entityType: 'ticket', entityId: t._id, after: { status: t.status } });
  res.json({ ok: true });
}));

// ---------------- Content / flags / settings ----------------
r.get('/content', requirePerm('content'), wrap(async (_req, res) => res.json({ pages: (await Content.find().select('slug title body version updatedAt history').lean()).map((c) => ({ ...c, history: (c.history || []).map((h) => ({ version: h.version, at: h.at, editedBy: h.editedBy })) })) })));
r.put('/content/:slug', requirePerm('content'), validate(z.object({ title: z.string().trim().min(2).max(120), body: z.string().min(20).max(60000) })), wrap(async (req, res) => {
  const c = await Content.findOne({ slug: req.params.slug }); if (!c) throw notFound('Page not found');
  c.history.push({ version: c.version, title: c.title, body: c.body, editedBy: req.user.email, at: new Date() });
  if (c.history.length > 30) c.history.shift();
  c.title = req.body.title; c.body = req.body.body; c.version += 1; c.updatedBy = req.user.id; await c.save();
  await audit(req, { action: 'admin.content_published', entityType: 'content', entityId: c.slug, after: { version: c.version } });
  res.json({ ok: true, version: c.version });
}));
r.get('/flags', requirePerm('flags'), wrap(async (_req, res) => res.json({ flags: await FeatureFlag.find().sort({ key: 1 }).lean() })));
r.put('/flags/:key', requirePerm('flags'), validate(z.object({ enabled: z.boolean() })), wrap(async (req, res) => {
  const f = await FeatureFlag.findOne({ key: req.params.key }); if (!f) throw notFound('Flag not found');
  const before = f.enabled; f.enabled = req.body.enabled; f.updatedBy = req.user.id; await f.save(); bust();
  await audit(req, { action: 'admin.flag_changed', entityType: 'flag', entityId: f.key, before: { enabled: before }, after: { enabled: f.enabled } });
  res.json({ ok: true });
}));
r.put('/settings', requirePerm('flags'), validate(z.object({ maintenance: z.boolean().optional(), banner: z.string().max(240).optional() })), wrap(async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) await Setting.updateOne({ key }, { value, updatedBy: req.user.id }, { upsert: true });
  bust(); await audit(req, { action: 'admin.settings_changed', after: req.body }); res.json({ ok: true });
}));
r.post('/broadcast', requirePerm('flags'), validate(z.object({ title: z.string().trim().min(3).max(100), body: z.string().trim().min(3).max(400) })), wrap(async (req, res) => {
  let n = 0; const cur = User.find({ status: 'active' }).select('_id').lean().cursor(); let batch = [];
  for await (const u of cur) { batch.push({ user: u._id, type: 'announcement', title: req.body.title, body: req.body.body, link: '/dashboard' }); if (batch.length >= 500) { await Notification.insertMany(batch); n += batch.length; batch = []; } }
  if (batch.length) { await Notification.insertMany(batch); n += batch.length; }
  await audit(req, { action: 'admin.broadcast', after: { title: req.body.title, recipients: n } }); res.json({ ok: true, recipients: n });
}));

r.get('/audit', requirePerm('audit'), wrap(async (req, res) => {
  const { skip, limit, page } = paging(req); const q = {};
  if (req.query.action) q.action = { $regex: `^${esc(req.query.action)}` }; if (req.query.scope) q.scope = String(req.query.scope);
  if (req.query.actorType) q.actorType = String(req.query.actorType);
  const [rows, total] = await Promise.all([AuditLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(q)]);
  res.json({ events: rows.map((a) => ({ id: a._id, at: a.createdAt, actorType: a.actorType, actor: a.actorEmail, action: a.action, scope: a.scope, entity: `${a.entityType || ''} ${a.entityId || ''}`.trim(), before: a.before, after: a.after, ip: a.ip })), total, page, pages: Math.ceil(total / limit) });
}));

r.get('/health', requirePerm('health'), wrap(async (_req, res) => {
  const t0 = Date.now(); let dbOk = false; try { await mongoose.connection.db.admin().ping(); dbOk = true; } catch { /* reported below */ }
  const mail = await verifyMailer();
  res.json({ api: { ok: true, uptimeSec: Math.round(process.uptime()), node: process.version, memoryMb: Math.round(process.memoryUsage().rss / 1048576) }, database: { ok: dbOk, latencyMs: Date.now() - t0 }, email: mail, jobs: { recurringDue: await RecurringRule.countDocuments({ active: true, nextRunAt: { $lte: new Date() } }), recurringActive: await RecurringRule.countDocuments({ active: true }) } });
}));
export default r;
