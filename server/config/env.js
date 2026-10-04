import 'dotenv/config';
import crypto from 'node:crypto';
import { z } from 'zod';

const bool = z.string().optional().transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_URL: z.string().url().default('http://localhost:5000'),
  CORS_ORIGINS: z.string().optional().default(''),
  MONGODB_URI: z.string().min(10).default('mongodb://127.0.0.1:27017/expensio'),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Expensio <no-reply@expensio.app>'),
  SEED_ADMIN_EMAIL: z.string().default('admin@expensio.local'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe!12345'),
  FX_RATES_JSON: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

function secret(name, value, minLen) {
  if (value && value.length >= minLen) return value;
  if (isProd) {
    console.error(`FATAL: ${name} must be set (min ${minLen} chars) in production. Run "npm run setup" to generate one.`);
    process.exit(1);
  }
  console.warn(`[env] ${name} not set – using an ephemeral dev secret (sessions reset on restart). Run "npm run setup".`);
  return crypto.randomBytes(minLen).toString('hex').slice(0, Math.max(minLen, 64));
}

export const config = {
  ...env,
  isProd,
  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET, 32),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, 32),
  ENCRYPTION_KEY: Buffer.from(secret('ENCRYPTION_KEY', env.ENCRYPTION_KEY, 32).padEnd(64, '0').slice(0, 64), 'hex'),
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  hasSmtp: Boolean(env.SMTP_HOST),
  ACCESS_TTL: '15m',
  REFRESH_TTL_MS: 30 * 24 * 3600 * 1000,
};
if (isProd && !config.hasSmtp) { console.error('FATAL: SMTP_HOST is required in production for email verification.'); process.exit(1); }
if (isProd && config.ENCRYPTION_KEY.length !== 32) { console.error('FATAL: ENCRYPTION_KEY must be 64 hex chars.'); process.exit(1); }
