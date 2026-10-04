import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Ticket, User } from '../models/index.js';
import { config } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, notFound } from '../lib/errors.js';
import { strictLimiter } from '../middleware/security.js';
import { sendMail } from '../lib/mailer.js';
import { T } from '../lib/emailTemplates.js';
import { randomToken } from '../lib/crypto.js';

const r = Router();
const ref = () => `EX-${randomToken(3).toUpperCase()}`;
const schema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().min(3, 'Add a short subject').max(140), message: z.string().trim().min(10, 'Tell us a little more').max(4000),
  category: z.enum(['general', 'billing', 'bug', 'account', 'business', 'feedback']).default('general'),
  website: z.string().max(0).optional(), // honeypot – bots fill this in
});

// Public contact form (optionally linked to the signed-in user).
r.post('/tickets', strictLimiter, validate(schema), wrap(async (req, res) => {
  if (req.body.website) return res.json({ ok: true });
  let user;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) { try { user = (await User.findById(jwt.verify(h.slice(7), config.JWT_ACCESS_SECRET).sub).select('_id').lean())?._id; } catch { /* anonymous */ } }
  const t = await Ticket.create({ ref: ref(), user, name: req.body.name, email: req.body.email, subject: req.body.subject, category: req.body.category, messages: [{ from: 'user', author: req.body.name, body: req.body.message }] });
  const m = T.support({ name: req.body.name, ticketId: t.ref, subject: t.subject });
  sendMail({ to: t.email, subject: m.subject, html: m.html });
  res.status(201).json({ ok: true, ref: t.ref });
}));

r.get('/tickets', authenticate, wrap(async (req, res) => {
  const list = await Ticket.find({ $or: [{ user: req.user.id }, { email: req.user.email }] }).sort({ updatedAt: -1 }).limit(50).lean();
  res.json({ tickets: list.map((t) => ({ id: t._id, ref: t.ref, subject: t.subject, status: t.status, updatedAt: t.updatedAt, messages: t.messages })) });
}));
r.post('/tickets/:id/reply', authenticate, strictLimiter, validate(z.object({ message: z.string().trim().min(1).max(4000) })), wrap(async (req, res) => {
  const t = await Ticket.findOne({ _id: req.params.id, $or: [{ user: req.user.id }, { email: req.user.email }] });
  if (!t) throw notFound('Ticket not found');
  t.messages.push({ from: 'user', author: req.user.name, body: req.body.message }); t.status = 'open'; await t.save();
  res.json({ ok: true });
}));
export default r;
