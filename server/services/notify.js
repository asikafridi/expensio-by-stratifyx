import crypto from 'node:crypto';
import { Notification, User } from '../models/index.js';
import { sendMail } from '../lib/mailer.js';
import { T } from '../lib/emailTemplates.js';

// ---- real-time hub (Server-Sent Events). For multi-instance scale-out, back with Redis pub/sub. ----
const clients = new Map(); // userId -> Set<res>
const tickets = new Map(); // ticket -> {userId, exp}

export function issueStreamTicket(userId) {
  const t = crypto.randomBytes(24).toString('hex');
  tickets.set(t, { userId: String(userId), exp: Date.now() + 30_000 });
  return t;
}
export function openStream(ticket, res) {
  const rec = tickets.get(ticket); tickets.delete(ticket);
  if (!rec || rec.exp < Date.now()) return false;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 5000\n\n');
  const set = clients.get(rec.userId) || new Set(); set.add(res); clients.set(rec.userId, set);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  res.on('close', () => { clearInterval(ping); set.delete(res); if (!set.size) clients.delete(rec.userId); });
  return true;
}
function push(userId, event, data) {
  for (const res of clients.get(String(userId)) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Create an in-app notification, push it live, and optionally email it
 * (respecting the recipient's per-category preferences).
 */
export async function notify(userId, { type = 'info', title, body, link, category = 'activity', email = false }) {
  const n = await Notification.create({ user: userId, type, title, body, link });
  push(userId, 'notification', { id: n._id, type, title, body, link, createdAt: n.createdAt });
  if (email) {
    const u = await User.findById(userId).select('name email emailVerified notificationPrefs').lean();
    if (u?.emailVerified && u.notificationPrefs?.[category] !== false) {
      const m = T.notify({ name: u.name, title, body, link });
      sendMail({ to: u.email, subject: m.subject, html: m.html });
    }
  }
  return n;
}
export const notifyMany = (ids, payload) => Promise.all([...new Set(ids.map(String))].map((id) => notify(id, payload).catch(() => null)));
