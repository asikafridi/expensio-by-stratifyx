import mongoose from 'mongoose';
import { config } from './config/env.js';
import { createApp } from './app.js';
import { log } from './lib/logger.js';
import { ensureDefaults } from './services/settings.js';
import { ensureContent } from './services/content.js';
import { startScheduler } from './services/scheduler.js';
import { setRates } from './engine/fx.js';

mongoose.set('strictQuery', true);

async function main() {
  if (config.FX_RATES_JSON) { try { setRates(JSON.parse(config.FX_RATES_JSON)); } catch { log.warn('FX_RATES_JSON is not valid JSON – ignored'); } }
  try {
    await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 20 });
  } catch (e) {
    log.error(`Cannot reach MongoDB at ${config.MONGODB_URI.replace(/\/\/.*@/, '//***@')}\n   → Start MongoDB (e.g. "docker compose up -d mongo") or set MONGODB_URI in .env\n   ${e.message}`);
    process.exit(1);
  }
  await mongoose.syncIndexes().catch((e) => log.warn('syncIndexes', { err: e.message }));
  await ensureDefaults(); await ensureContent();
  const app = createApp();
  const server = app.listen(config.PORT, () => log.info(`Expensio running → ${config.APP_URL.replace(/:\d+$/, '')}:${config.PORT}  (${config.NODE_ENV})`));
  const scheduler = startScheduler();

  const stop = (sig) => {
    log.info(`${sig} received, shutting down…`); clearInterval(scheduler);
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
}
process.on('unhandledRejection', (e) => log.error('unhandledRejection', { err: String(e?.stack || e) }));
main();
