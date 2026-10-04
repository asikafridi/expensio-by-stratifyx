import rateLimit from 'express-rate-limit';

const make = (windowMs, max, message) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: message, code: 'RATE_LIMITED' }),
});
export const apiLimiter = make(60_000, 300, 'Too many requests. Please slow down.');
export const authLimiter = make(15 * 60_000, 40, 'Too many attempts. Try again in a few minutes.');
export const strictLimiter = make(60 * 60_000, 10, 'Too many requests from this device. Try again later.');

/** Rejects NoSQL-operator injection ({"$gt": ""}) and prototype-pollution keys anywhere in body/query/params. */
export function noSqlSanitize(req, res, next) {
  const bad = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 8) return false;
    return Object.keys(o).some((k) => k.startsWith('$') || k === '__proto__' || k === 'constructor' || bad(o[k], depth + 1));
  };
  if (bad(req.body) || bad(req.query) || bad(req.params)) return res.status(400).json({ error: 'Invalid characters in request', code: 'BAD_REQUEST' });
  next();
}
