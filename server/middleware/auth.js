import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User, STAFF_ROLES } from '../models/index.js';
import { unauthorized, forbidden, wrap } from '../lib/errors.js';

export const PERMS = {
  super_admin: ['*'],
  kyc_reviewer: ['overview', 'kyc'],
  support: ['overview', 'users:read', 'tickets', 'businesses:read'],
  content_editor: ['overview', 'content'],
};

export const authenticate = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw unauthorized();
  let p;
  try { p = jwt.verify(h.slice(7), config.JWT_ACCESS_SECRET); } catch { throw unauthorized('Session expired', 'TOKEN_EXPIRED'); }
  const u = await User.findById(p.sub).select('name email role status emailVerified tokenVersion twoFactorEnabled baseCurrency avatar').lean();
  if (!u || u.status !== 'active' || (u.tokenVersion || 0) !== p.v) throw unauthorized('Session is no longer valid', 'TOKEN_REVOKED');
  req.user = { ...u, id: String(u._id), isStaff: STAFF_ROLES.includes(u.role) };
  next();
});

export const requireVerified = (req, _res, next) =>
  req.user.emailVerified ? next() : next(forbidden('Please verify your email address first', 'EMAIL_NOT_VERIFIED'));

export const requirePerm = (perm) => (req, _res, next) => {
  const allowed = PERMS[req.user.role] || [];
  const [mod] = perm.split(':');
  if (allowed.includes('*') || allowed.includes(perm) || (!perm.includes(':') && allowed.includes(mod)) || (perm.endsWith(':read') && allowed.includes(mod))) return next();
  return next(forbidden('Your staff role cannot access this module', 'STAFF_FORBIDDEN'));
};
export const requireStaff = (req, _res, next) => (req.user.isStaff ? next() : next(forbidden('Staff only')));
