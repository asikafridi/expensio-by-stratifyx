import { FeatureFlag, Setting } from '../models/index.js';

const DEFAULT_FLAGS = [
  ['debtSimplification', 'Offer minimum-transfer settlement plans', true],
  ['recurringExpenses', 'Weekly / monthly / yearly recurring expenses', true],
  ['businessModule', 'Business partnership ledger (NID verified)', true],
  ['signups', 'Allow new account registrations', true],
  ['referrals', 'Invite-a-friend referral rewards', false],
  ['receiptOcr', 'Receipt scanning (OCR) – coming soon', false],
];
let cache = { at: 0, flags: {}, settings: {} };

export async function ensureDefaults() {
  for (const [key, description, enabled] of DEFAULT_FLAGS) {
    await FeatureFlag.updateOne({ key }, { $setOnInsert: { key, description, enabled } }, { upsert: true });
  }
  for (const [key, value] of [['maintenance', false], ['banner', '']]) {
    await Setting.updateOne({ key }, { $setOnInsert: { key, value } }, { upsert: true });
  }
}

export async function snapshot(force = false) {
  if (!force && Date.now() - cache.at < 10_000) return cache;
  const [flags, settings] = await Promise.all([FeatureFlag.find().lean(), Setting.find().lean()]);
  cache = {
    at: Date.now(),
    flags: Object.fromEntries(flags.map((f) => [f.key, f.enabled])),
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  };
  return cache;
}
export const flag = async (key) => Boolean((await snapshot()).flags[key]);
export const bust = () => { cache.at = 0; };
