import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config/env.js';
import { User, STAFF_ROLES } from '../models/index.js';
import { validate } from '../lib/validate.js';
import { wrap, ApiError, unauthorized, badRequest } from '../lib/errors.js';
import { sha256, randomToken, randomCode, safeEqual } from '../lib/crypto.js';
import { sendMail } from '../lib/mailer.js';
import { T } from '../lib/emailTemplates.js';
import { authLimiter, strictLimiter } from '../middleware/security.js';
import { authenticate } from '../middleware/auth.js';
import { signAccess, signChallenge, verifyChallenge, startSession, rotateSession, revokeToken, revokeAll, cookieOpts } from '../services/tokens.js';
import { flag } from '../services/settings.js';
import { audit } from '../services/audit.js';
import { isCurrency } from '../engine/money.js';

const r = Router();
const COOKIE = 'expensio_rt';
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);
export const password = z.string().min(8, 'Use at least 8 characters').max(128)
  .refine((s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s), 'Use upper & lower case letters and a number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email, password,
  phone: z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, 'Enter a valid phone number').optional().or(z.literal('')),
  mobileBanking: z.object({ provider: z.enum(['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank', 'Other', '']).optional(), number: z.string().trim().max(24).optional() }).optional(),
  baseCurrency: z.string().refine(isCurrency).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms and Privacy Policy' }) }),
});

async function sendVerification(user) {
  const token = randomToken(32); const otp = randomCode();
  user.verify = { tokenHash: sha256(token), codeHash: sha256(`${user._id}:${otp}`), expiresAt: new Date(Date.now() + 24 * 3600e3), attempts: 0, sentAt: new Date() };
  await user.save();
  const m = T.verify({ name: user.name, token, otp });
  await sendMail({ to: user.email, subject: m.subject, html: m.html, devHint: `verify link: ${config.APP_URL}/#/verify-email?token=${token}   code: ${otp}` });
}
export async function issueOtp(user, purpose) {
  const otp = randomCode();
  user.otp = { hash: sha256(`${user._id}:${otp}`), purpose, expiresAt: new Date(Date.now() + 10 * 60e3), attempts: 0 };
  await user.save();
  const m = T.otp({ name: user.name, otp, purpose });
  await sendMail({ to: user.email, subject: m.subject, html: m.html, devHint: `security code: ${otp}` });
}
export function checkOtp(user, purpose, code) {
  const o = user.otp;
  if (!o?.hash || o.purpose !== purpose || o.expiresAt < new Date()) throw badRequest('That code has expired. Request a new one.', 'OTP_EXPIRED');
  if (o.attempts >= 5) throw new ApiError(429, 'Too many wrong attempts. Request a new code.', 'OTP_LOCKED');
  if (!safeEqual(o.hash, sha256(`${user._id}:${code}`))) { user.otp.attempts += 1; return false; }
  user.otp = undefined; return true;
}

async function finishLogin(user, req, res) {
  user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date(); user.lastLoginIp = req.ip;
  await user.save();
  const refresh = await startSession(user, req);
  res.cookie(COOKIE, refresh, cookieOpts(config.isProd));
  await audit({ ...req, user: { id: String(user._id), email: user.email, isStaff: STAFF_ROLES.includes(user.role) }, ip: req.ip }, { action: 'auth.login', entityType: 'user', entityId: user._id });
  const body = { accessToken: signAccess(user), user: user.toSafe() };
  if (req.headers['x-client'] === 'mobile') body.refreshToken = refresh;
  return res.json(body);
}

r.post('/register', authLimiter, validate(registerSchema), wrap(async (req, res) => {
  if (!(await flag('signups'))) throw new ApiError(403, 'New sign-ups are temporarily paused.', 'SIGNUPS_PAUSED');
  const b = req.body;
  if (await User.exists({ email: b.email })) throw new ApiError(409, 'An account with this email already exists. Try signing in.', 'EMAIL_TAKEN');
  const user = new User({ name: b.name, email: b.email, phone: b.phone || '', mobileBanking: b.mobileBanking || {}, baseCurrency: b.baseCurrency || 'BDT', passwordHash: await bcrypt.hash(b.password, 12), avatar: { emoji: ['🦊', '🐼', '🦁', '🐯', '🦄', '🐙', '🐳', '🦉'][Math.floor(Math.random() * 8)], color: ['#0E7C7B', '#6366f1', '#f59e0b', '#ec4899', '#10b981', '#3b82f6'][Math.floor(Math.random() * 6)] } });
  await user.save();
  await sendVerification(user);
  return finishLogin(user, req, res.status(201));
}));

r.post('/verify-email', authLimiter, validate(z.object({ token: z.string().optional(), email: email.optional(), code: z.string().regex(/^\d{6}$/).optional() })), wrap(async (req, res) => {
  const { token, email: em, code } = req.body;
  let user;
  if (token) {
    user = await User.findOne({ 'verify.tokenHash': sha256(token) });
    if (!user || user.verify.expiresAt < new Date()) throw badRequest('This verification link is invalid or has expired. Request a new one.', 'VERIFY_INVALID');
  } else if (em && code) {
    user = await User.findOne({ email: em });
    if (!user?.verify?.codeHash || user.verify.expiresAt < new Date()) throw badRequest('Code expired. Request a new one.', 'VERIFY_INVALID');
    if (user.verify.attempts >= 5) throw new ApiError(429, 'Too many attempts. Request a new code.', 'OTP_LOCKED');
    if (!safeEqual(user.verify.codeHash, sha256(`${user._id}:${code}`))) { user.verify.attempts += 1; await user.save(); throw badRequest('Incorrect code', 'VERIFY_INVALID'); }
  } else throw badRequest('Provide a token, or email and code');
  user.emailVerified = true; user.verify = undefined; await user.save();
  res.json({ ok: true, email: user.email });
}));

r.post('/resend-verification', strictLimiter, validate(z.object({ email })), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && !user.emailVerified && (!user.verify?.sentAt || Date.now() - user.verify.sentAt > 45e3)) await sendVerification(user);
  res.json({ ok: true }); // never reveals whether the account exists
}));

const DUMMY = bcrypt.hashSync('dummy-password-for-timing', 12);
r.post('/login', authLimiter, validate(z.object({ email, password: z.string().min(1).max(128) })), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user) { await bcrypt.compare(req.body.password, DUMMY); throw unauthorized('Incorrect email or password', 'BAD_CREDENTIALS'); }
  if (user.lockUntil && user.lockUntil > new Date()) throw new ApiError(423, `Account temporarily locked. Try again in ${Math.ceil((user.lockUntil - Date.now()) / 60000)} min.`, 'LOCKED');
  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= 5) { user.lockUntil = new Date(Date.now() + 15 * 60e3); user.failedLogins = 0; }
    await user.save();
    throw unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');
  }
  if (user.status !== 'active') throw new ApiError(403, 'This account has been disabled. Contact support.', 'DISABLED');
  const isStaff = STAFF_ROLES.includes(user.role);
  if (user.twoFactorEnabled || isStaff) { // staff ALWAYS require a second factor
    await issueOtp(user, 'login');
    return res.json({ requires2fa: true, challenge: signChallenge(user, '2fa'), email: user.email });
  }
  return finishLogin(user, req, res);
}));

r.post('/2fa/verify', authLimiter, validate(z.object({ challenge: z.string(), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })), wrap(async (req, res) => {
  let p; try { p = verifyChallenge(req.body.challenge, '2fa'); } catch { throw unauthorized('Sign-in expired. Please start again.', 'CHALLENGE_EXPIRED'); }
  const user = await User.findById(p.sub);
  if (!user || user.status !== 'active') throw unauthorized();
  const ok = checkOtp(user, 'login', req.body.code);
  if (!ok) { await user.save(); throw unauthorized('Incorrect code', 'BAD_OTP'); }
  return finishLogin(user, req, res);
}));

r.post('/refresh', wrap(async (req, res) => {
  const raw = req.cookies?.[COOKIE] || req.body?.refreshToken;
  if (!raw) throw unauthorized('No session', 'NO_SESSION');
  const rot = await rotateSession(raw, req);
  if (!rot || rot.reuse) { res.clearCookie(COOKIE, { path: '/api/v1/auth' }); throw unauthorized(rot?.reuse ? 'Security alert: please sign in again' : 'Session expired', 'SESSION_EXPIRED'); }
  const user = await User.findById(rot.userId);
  if (!user || user.status !== 'active') throw unauthorized();
  res.cookie(COOKIE, rot.raw, cookieOpts(config.isProd));
  const body = { accessToken: signAccess(user), user: user.toSafe() };
  if (req.headers['x-client'] === 'mobile') body.refreshToken = rot.raw;
  res.json(body);
}));

r.post('/logout', wrap(async (req, res) => {
  const raw = req.cookies?.[COOKIE] || req.body?.refreshToken;
  if (raw) await revokeToken(raw);
  res.clearCookie(COOKIE, { path: '/api/v1/auth' });
  res.json({ ok: true });
}));

r.post('/logout-all', authenticate, wrap(async (req, res) => {
  await revokeAll(req.user.id);
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie(COOKIE, { path: '/api/v1/auth' });
  res.json({ ok: true });
}));

r.post('/forgot-password', strictLimiter, validate(z.object({ email })), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.status === 'active') {
    const token = randomToken(32);
    user.reset = { tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) }; await user.save();
    const m = T.reset({ name: user.name, token });
    await sendMail({ to: user.email, subject: m.subject, html: m.html, devHint: `reset link: ${config.APP_URL}/#/reset-password?token=${token}` });
  }
  res.json({ ok: true });
}));

r.post('/reset-password', authLimiter, validate(z.object({ token: z.string().min(10), password })), wrap(async (req, res) => {
  const user = await User.findOne({ 'reset.tokenHash': sha256(req.body.token) });
  if (!user || user.reset.expiresAt < new Date()) throw badRequest('This reset link is invalid or has expired.', 'RESET_INVALID');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.reset = undefined; user.tokenVersion += 1; user.failedLogins = 0; user.lockUntil = undefined;
  await user.save(); await revokeAll(user._id);
  res.json({ ok: true });
}));

export default r;
