import { Router } from 'express';
import { Notification } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { wrap, unauthorized } from '../lib/errors.js';
import { issueStreamTicket, openStream } from '../services/notify.js';

const r = Router();

// EventSource can't send headers, so it authenticates with a 30-second single-use ticket.
r.get('/stream', (req, res) => { if (!openStream(String(req.query.ticket || ''), res)) res.status(401).json({ error: 'Invalid ticket' }); });

r.use(authenticate);
r.post('/stream-ticket', (req, res) => res.json({ ticket: issueStreamTicket(req.user.id) }));
r.get('/', wrap(async (req, res) => {
  const [items, unread] = await Promise.all([Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(), Notification.countDocuments({ user: req.user.id, readAt: null })]);
  res.json({ notifications: items.map((n) => ({ id: n._id, type: n.type, title: n.title, body: n.body, link: n.link, read: Boolean(n.readAt), createdAt: n.createdAt })), unread });
}));
r.get('/unread-count', wrap(async (req, res) => res.json({ unread: await Notification.countDocuments({ user: req.user.id, readAt: null }) })));
r.post('/read-all', wrap(async (req, res) => { await Notification.updateMany({ user: req.user.id, readAt: null }, { readAt: new Date() }); res.json({ ok: true }); }));
r.post('/:id/read', wrap(async (req, res) => { await Notification.updateOne({ _id: req.params.id, user: req.user.id }, { readAt: new Date() }); res.json({ ok: true }); }));
export default r;
