import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './config/env.js';
import { apiLimiter, noSqlSanitize } from './middleware/security.js';
import { errorHandler, notFoundApi } from './middleware/error.js';
import { snapshot } from './services/settings.js';
import { authenticate } from './middleware/auth.js';

import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import groupRoutes from './routes/groups.js';
import expenseRoutes from './routes/expenses.js';
import settlementRoutes from './routes/settlements.js';
import invitationRoutes, { publicInvitations } from './routes/invitations.js';
import notificationRoutes from './routes/notifications.js';
import businessRoutes from './routes/business.js';
import analyticsRoutes from './routes/analytics.js';
import supportRoutes from './routes/support.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.isProd ? 1 : false);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"],
        objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
      }
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(cors({ origin: (o, cb) => cb(null, !o || config.corsOrigins.includes(o) || o === config.APP_URL), credentials: true }));
  if (!config.isProd) app.use(morgan('dev'));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter);
  app.use(noSqlSanitize);

  const v1 = express.Router();
  // Maintenance mode: only staff, sign-in, config and health stay reachable.
  v1.use(async (req, res, next) => {
    try {
      const s = await snapshot();
      if (!s.settings.maintenance || /^\/(auth|config|health|admin|content)/.test(req.path)) return next();
      return res.status(503).json({ error: 'Expensio is undergoing scheduled maintenance. Back shortly!', code: 'MAINTENANCE' });
    } catch (e) { return next(e); }
  });
  v1.use(publicRoutes);
  v1.use(publicInvitations);
  v1.use('/support', supportRoutes);
  v1.use('/auth', authRoutes);
  v1.use('/notifications', notificationRoutes);
  v1.use('/me', meRoutes);
  v1.use('/groups', groupRoutes);
  v1.use('/business', businessRoutes);
  v1.use('/analytics', analyticsRoutes);
  v1.use('/admin', adminRoutes);
  // Routers below are mounted at root and authenticate internally – keep them last.
  v1.use(expenseRoutes);
  v1.use(settlementRoutes);
  v1.use(invitationRoutes);
  app.use('/api/v1', v1);
  app.use('/api', notFoundApi);

  const web = path.resolve(__dirname, '../web');
  app.use(express.static(web, { maxAge: config.isProd ? '1h' : 0, setHeaders: (res, p) => { if (p.endsWith('sw.js') || p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get('*', (_req, res) => res.sendFile(path.join(web, 'index.html')));
  app.use(errorHandler);
  return app;
}
export { authenticate };
