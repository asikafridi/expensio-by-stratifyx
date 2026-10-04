import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { sha256, randomToken } from '../lib/crypto.js';
import { Session } from '../models/index.js';

export const signAccess = (u) => jwt.sign({ sub: String(u._id || u.id), role: u.role, v: u.tokenVersion || 0 }, config.JWT_ACCESS_SECRET, { expiresIn: config.ACCESS_TTL });
export const signChallenge = (u, purpose) => jwt.sign({ sub: String(u._id), purpose }, config.JWT_REFRESH_SECRET, { expiresIn: '10m' });
export const verifyChallenge = (t, purpose) => {
  const p = jwt.verify(t, config.JWT_REFRESH_SECRET);
  if (p.purpose !== purpose) throw new Error('bad purpose');
  return p;
};

export async function startSession(user, req) {
  const raw = randomToken(48);
  await Session.create({ user: user._id, tokenHash: sha256(raw), userAgent: String(req.headers['user-agent'] || '').slice(0, 200), ip: req.ip, expiresAt: new Date(Date.now() + config.REFRESH_TTL_MS), lastUsedAt: new Date() });
  return raw;
}

/** Refresh-token rotation with reuse detection (a replayed token revokes every session of that user). */
export async function rotateSession(rawToken, req) {
  const s = await Session.findOne({ tokenHash: sha256(rawToken) });
  if (!s) return null;
  if (s.revokedAt) { await Session.updateMany({ user: s.user, revokedAt: null }, { revokedAt: new Date() }); return { reuse: true }; }
  if (s.expiresAt < new Date()) return null;
  const next = randomToken(48);
  s.revokedAt = new Date(); s.replacedBy = sha256(next); await s.save();
  await Session.create({ user: s.user, tokenHash: sha256(next), userAgent: String(req.headers['user-agent'] || '').slice(0, 200), ip: req.ip, expiresAt: new Date(Date.now() + config.REFRESH_TTL_MS), lastUsedAt: new Date() });
  return { userId: s.user, raw: next };
}
export const revokeToken = (raw) => Session.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { revokedAt: new Date() });
export const revokeAll = (userId) => Session.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });

export const cookieOpts = (isProd) => ({ httpOnly: true, sameSite: 'lax', secure: isProd, path: '/api/v1/auth', maxAge: config.REFRESH_TTL_MS });
