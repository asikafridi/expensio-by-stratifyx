// Creates the first Super Admin (and optional demo data with --demo). Idempotent.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../server/config/env.js';
import { User, Group, Expense } from '../server/models/index.js';
import { ensureDefaults } from '../server/services/settings.js';
import { ensureContent } from '../server/services/content.js';
import { buildExpense } from '../server/services/groups.js';

await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
await ensureDefaults(); await ensureContent();

const mk = async (name, email, password, extra = {}) => {
  let u = await User.findOne({ email });
  if (!u) u = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), emailVerified: true, ...extra });
  return u;
};

const admin = await mk('Platform Admin', config.SEED_ADMIN_EMAIL.toLowerCase(), config.SEED_ADMIN_PASSWORD, { role: 'super_admin', twoFactorEnabled: true, onboardingDone: true, avatar: { emoji: '🛡️', color: '#16233F' } });
console.log(`✔ Super Admin ready: ${admin.email}  (sign in at /#/login — a 6-digit code is emailed/printed on every staff sign-in)`);

if (process.argv.includes('--demo')) {
  const pw = 'Demo!12345a';
  const [a, b, c, d] = await Promise.all([mk('Ashik', 'ashik@demo.expensio.app', pw, { onboardingDone: true, avatar: { emoji: '🦊', color: '#0E7C7B' } }), mk('Nafil', 'nafil@demo.expensio.app', pw, { onboardingDone: true, avatar: { emoji: '🦄', color: '#ec4899' } }), mk('Sakaria', 'sakaria@demo.expensio.app', pw, { onboardingDone: true, avatar: { emoji: '🐼', color: '#6366f1' } }), mk('Dristy', 'dristy@demo.expensio.app', pw, { onboardingDone: true, avatar: { emoji: '🦉', color: '#f59e0b' } })]);
  if (!(await Group.exists({ name: 'Cox’s Bazar Trip 🌊', createdBy: a._id }))) {
    const g = await Group.create({ name: 'Cox’s Bazar Trip 🌊', emoji: '🏖️', category: 'trip', destination: 'Cox’s Bazar', baseCurrency: 'BDT', createdBy: a._id, members: [{ user: a._id, role: 'admin' }, { user: b._id }, { user: c._id }, { user: d._id }] });
    const ids = [a, b, c, d].map((u) => String(u._id));
    const all = ids.map((userId) => ({ userId }));
    const seed = [
      { title: 'Hotel (2 nights)', amount: 18000, category: 'stay', splitType: 'equal', participants: all, payers: [{ userId: ids[0], amount: 18000 }] },
      { title: 'Seafood dinner', amount: 7450.5, category: 'food', splitType: 'itemized', participants: [], items: [{ name: 'Fish platter', amount: 4200, assignees: ids }, { name: 'Prawns', amount: 2800, assignees: [ids[1], ids[2]] }], payers: [{ userId: ids[1], amount: 7450.5 }] },
      { title: 'Bus tickets', amount: 3600, category: 'transport', splitType: 'percent', participants: [{ userId: ids[0], value: 40 }, { userId: ids[1], value: 30 }, { userId: ids[2], value: 30 }], payers: [{ userId: ids[2], amount: 3600 }] },
    ];
    for (const e of seed) await Expense.create({ ...buildExpense(g, e, ids[0]), group: g._id, createdBy: ids[0] });
    console.log('✔ Demo data created. Sign in as ashik@demo.expensio.app / Demo!12345a');
  }
}
await mongoose.disconnect();
