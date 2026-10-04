import crypto from 'node:crypto';
import { config } from '../config/env.js';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const randomCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** AES-256-GCM. Output is a compact object safe to store in MongoDB. */
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', config.ENCRYPTION_KEY, iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
export function decrypt(box) {
  const d = crypto.createDecipheriv('aes-256-gcm', config.ENCRYPTION_KEY, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8');
}
/** Deterministic keyed hash – lets us detect duplicate NIDs without storing them in clear. */
export const blindIndex = (value) => crypto.createHmac('sha256', config.ENCRYPTION_KEY).update(String(value)).digest('hex');
export const maskNid = (nid) => `${'•'.repeat(Math.max(0, String(nid).length - 4))}${String(nid).slice(-4)}`;
