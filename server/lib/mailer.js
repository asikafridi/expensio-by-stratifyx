import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { log } from './logger.js';

let transport = null;
if (config.hasSmtp) {
  transport = nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    pool: true, maxConnections: 3,
  });
}

/** Sends (or, in dev without SMTP, prints + saves) a transactional email. Never throws to callers. */
export async function sendMail({ to, subject, html, text, devHint }) {
  try {
    if (!transport) {
      const dir = path.resolve('.dev-mail');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, '_')}.html`);
      fs.writeFileSync(file, html);
      log.info(`✉  [DEV MAIL] to=${to} subject="${subject}"${devHint ? `\n   ➜ ${devHint}` : ''}\n   saved: ${file}`);
      return { dev: true };
    }
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, html, text: text || subject });
    return { ok: true };
  } catch (e) {
    log.error('Email send failed', { to, subject, err: e.message });
    return { ok: false };
  }
}

export const mailerStatus = () => ({ mode: transport ? 'smtp' : 'dev-console', host: config.SMTP_HOST || null });
export async function verifyMailer() {
  if (!transport) return { ok: true, mode: 'dev-console' };
  try { await transport.verify(); return { ok: true, mode: 'smtp' }; } catch (e) { return { ok: false, mode: 'smtp', error: e.message }; }
}
