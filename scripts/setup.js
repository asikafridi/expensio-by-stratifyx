// Creates .env from .env.example with freshly generated secrets. Safe to re-run (never overwrites).
import fs from 'node:fs';
import crypto from 'node:crypto';

if (fs.existsSync('.env')) { console.log('✔ .env already exists – leaving it untouched.'); process.exit(0); }
let env = fs.readFileSync('.env.example', 'utf8');
const fill = (k, v) => { env = env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`); };
fill('JWT_ACCESS_SECRET', crypto.randomBytes(48).toString('hex'));
fill('JWT_REFRESH_SECRET', crypto.randomBytes(48).toString('hex'));
fill('ENCRYPTION_KEY', crypto.randomBytes(32).toString('hex'));
fill('SEED_ADMIN_PASSWORD', `Ex!${crypto.randomBytes(6).toString('hex')}Aa1`);
fs.writeFileSync('.env', env);
console.log('✔ Created .env with new random secrets.\n  Open it to review SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD before running "npm run seed".');
