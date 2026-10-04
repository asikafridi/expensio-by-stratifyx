import { Router } from 'express';
import mongoose from 'mongoose';
import { Content } from '../models/index.js';
import { snapshot } from '../services/settings.js';
import { CURRENCIES } from '../engine/money.js';
import { getRates } from '../engine/fx.js';
import { wrap, notFound } from '../lib/errors.js';

const r = Router();
r.get('/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded', uptime: Math.round(process.uptime()), time: new Date().toISOString() }));
r.get('/config', wrap(async (_req, res) => {
  const s = await snapshot();
  res.json({ flags: s.flags, banner: s.settings.banner || '', maintenance: Boolean(s.settings.maintenance), currencies: CURRENCIES, fxRates: getRates(), version: '1.0.0' });
}));
r.get('/content/:slug', wrap(async (req, res) => {
  const c = await Content.findOne({ slug: req.params.slug }).select('slug title body version updatedAt').lean();
  if (!c) throw notFound('Page not found');
  res.set('Cache-Control', 'public, max-age=300').json(c);
}));
export default r;
