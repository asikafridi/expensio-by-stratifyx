import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Session, Group, Expense, Settlement, NidRecord, Business, Ticket } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, unauthorized, badRequest, notFound } from '../lib/errors.js';
import { isCurrency } from '../engine/money.js';
import { sha256 } from '../lib/crypto.js';
import { issueOtp, checkOtp, password } from './auth.js';
import { signAccess, startSession, revokeAll, cookieOpts } from '../services/tokens.js';
import { submitNid, nidSchema, nidView } from '../services/kyc.js';
import { audit } from '../services/audit.js';
import { config } from '../config/env.js';
import { authLimiter } from '../middleware/security.js';

const r = Router();
r.use(authenticate);

r.get('/', wrap(async (req, res) => {
  const u = await User.findById(req.user.id);
  res.json({ user: u.toSafe() });
}));

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, 'Enter a valid phone number').or(z.literal('')),
  mobileBanking: z.object({ provider: z.enum(['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank', 'Other', '']), number: z.string().trim().max(24) }),
  avatar: z.object({ emoji: z.string().max(8), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  baseCurrency: z.string().refine(isCurrency),
  notificationPrefs: z.object({ activity: z.boolean(), settlements: z.boolean(), invites: z.boolean(), marketing: z.boolean() }).partial(),
  onboardingDone: z.boolean(),
}).partial();

r.patch('/', validate(patchSchema), wrap(async (req, res) => {
  const u = await User.findById(req.user.id);
  const b = req.body;
  for (const k of ['name', 'phone', 'baseCurrency', 'onboardingDone']) if (b[k] !== undefined) u[k] = b[k];
  if (b.mobileBanking) u.mobileBanking = b.mobileBanking;
  if (b.avatar) u.avatar = b.avatar;
  if (b.notificationPrefs) Object.assign(u.notificationPrefs, b.notificationPrefs);
  await u.save();
  res.json({ user: u.toSafe() });
}));

r.post('/change-password', authLimiter, validate(z.object({ currentPassword: z.string().min(1), newPassword: password })), wrap(async (req, res) => {
  const u = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw unauthorized('Current password is incorrect', 'BAD_CREDENTIALS');
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 12); u.tokenVersion += 1; await u.save();
  await revokeAll(u._id);
  const refresh = await startSession(u, req);
  res.cookie('expensio_rt', refresh, cookieOpts(config.isProd));
  res.json({ ok: true, accessToken: signAccess(u), refreshToken: req.headers['x-client'] === 'mobile' ? refresh : undefined });
}));

r.get('/sessions', wrap(async (req, res) => {
  const list = await Session.find({ user: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).select('userAgent ip createdAt lastUsedAt tokenHash').lean();
  const cur = req.cookies?.expensio_rt ? sha256(req.cookies.expensio_rt) : null;
  res.json({ sessions: list.map((s) => ({ id: s._id, userAgent: s.userAgent, ip: s.ip, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, current: s.tokenHash === cur })) });
}));
r.delete('/sessions/:id', wrap(async (req, res) => {
  await Session.updateOne({ _id: req.params.id, user: req.user.id }, { revokedAt: new Date() });
  res.json({ ok: true });
}));

// ----- Two-factor (email one-time code) -----
r.post('/2fa/request', authLimiter, wrap(async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!u.emailVerified) throw badRequest('Verify your email first', 'EMAIL_NOT_VERIFIED');
  await issueOtp(u, 'enable-2fa'); res.json({ ok: true });
}));
r.post('/2fa/enable', authLimiter, validate(z.object({ code: z.string().regex(/^\d{6}$/) })), wrap(async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!checkOtp(u, 'enable-2fa', req.body.code)) { await u.save(); throw badRequest('Incorrect code', 'BAD_OTP'); }
  u.twoFactorEnabled = true; await u.save();
  await audit(req, { action: '2fa.enabled', entityType: 'user', entityId: u._id });
  res.json({ user: u.toSafe() });
}));
r.post('/2fa/disable', authLimiter, validate(z.object({ password: z.string().min(1) })), wrap(async (req, res) => {
  const u = await User.findById(req.user.id).select('+passwordHash');
  if (u.role !== 'user') throw badRequest('Two-factor is mandatory for staff accounts');
  if (!(await bcrypt.compare(req.body.password, u.passwordHash))) throw unauthorized('Password is incorrect', 'BAD_CREDENTIALS');
  if (await Business.exists({ 'partners.user': u._id, 'partners.role': 'owner' })) throw badRequest('Two-factor is required while you own a business', 'TWO_FA_REQUIRED');
  u.twoFactorEnabled = false; await u.save();
  res.json({ user: u.toSafe() });
}));

// ----- Identity (NID) -----
r.get('/kyc', wrap(async (req, res) => {
  res.json({ kyc: nidView(await NidRecord.findOne({ user: req.user.id }).lean()) || null });
}));
r.post('/kyc', authLimiter, validate(nidSchema), wrap(async (req, res) => {
  if (!req.user.emailVerified) throw badRequest('Verify your email first', 'EMAIL_NOT_VERIFIED');
  const rec = await submitNid(req.user.id, req.body);
  await audit(req, { action: 'kyc.submitted', entityType: 'nid', entityId: rec._id });
  res.json({ kyc: nidView(rec) });
}));

// ----- Data rights -----
r.get('/export', wrap(async (req, res) => {
  const id = req.user.id;
  const [user, groups, expenses, settlements, kyc] = await Promise.all([
    User.findById(id).lean(), Group.find({ 'members.user': id }).lean(),
    Expense.find({ $or: [{ 'paid.user': id }, { 'owed.user': id }], deletedAt: null }).select('-history -input').lean(),
    Settlement.find({ $or: [{ from: id }, { to: id }] }).lean(), NidRecord.findOne({ user: id }).lean(),
  ]);
  delete user.passwordHash; delete user.verify; delete user.reset; delete user.otp;
  res.setHeader('Content-Disposition', 'attachment; filename="expensio-my-data.json"');
  res.json({ exportedAt: new Date(), user, groups, expenses, settlements, identity: nidView(kyc) });
}));

r.post('/delete-request', validate(z.object({ reason: z.string().max(500).optional() })), wrap(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { deletionRequestedAt: new Date() });
  const ref = `EX-${Date.now().toString(36).toUpperCase()}`;
  await Ticket.create({ ref, user: req.user.id, name: req.user.name, email: req.user.email, subject: 'Account deletion request', category: 'data-deletion', priority: 'high', messages: [{ from: 'user', author: req.user.name, body: req.body.reason || 'Please delete my account and personal data.' }] });
  await audit(req, { action: 'account.deletion_requested', entityType: 'user', entityId: req.user.id });
  res.json({ ok: true, ref });
}));

export default r;
