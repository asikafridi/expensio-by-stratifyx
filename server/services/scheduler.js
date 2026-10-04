import { RecurringRule, Group } from '../models/index.js';
import { buildExpense, activeIds } from './groups.js';
import { Expense } from '../models/index.js';
import { log } from '../lib/logger.js';
import { notifyMany } from './notify.js';
import { flag } from './settings.js';

export function nextDate(d, frequency) {
  const n = new Date(d);
  if (frequency === 'weekly') n.setUTCDate(n.getUTCDate() + 7);
  else if (frequency === 'monthly') n.setUTCMonth(n.getUTCMonth() + 1);
  else n.setUTCFullYear(n.getUTCFullYear() + 1);
  return n;
}

/** Atomically claims each due rule (safe with several app instances) and generates its expense. */
export async function runRecurringOnce(now = new Date()) {
  if (!(await flag('recurringExpenses'))) return 0;
  let created = 0;
  for (let i = 0; i < 200; i++) {
    const rule = await RecurringRule.findOneAndUpdate(
      { active: true, nextRunAt: { $lte: now } },
      { $set: { lastRunAt: now }, $inc: { runCount: 1 } },
      { new: false },
    );
    if (!rule) break;
    const runAt = rule.nextRunAt;
    const upcoming = nextDate(runAt, rule.frequency);
    const finished = rule.endAt && upcoming > rule.endAt;
    await RecurringRule.updateOne({ _id: rule._id }, { nextRunAt: upcoming, active: !finished });
    try {
      const group = await Group.findById(rule.group);
      if (!group || group.status !== 'active' || !activeIds(group).includes(String(rule.createdBy))) { await RecurringRule.updateOne({ _id: rule._id }, { active: false }); continue; }
      const doc = buildExpense(group, { ...rule.payload, date: runAt }, rule.createdBy);
      await Expense.create({ ...doc, group: group._id, createdBy: rule.createdBy, recurringRule: rule._id });
      await Group.updateOne({ _id: group._id }, { lastActivityAt: new Date() });
      await notifyMany(doc.owed.map((o) => o.user), { type: 'expense', category: 'activity', title: `Recurring expense added in ${group.name}`, body: `“${doc.title}” was added automatically.`, link: `/groups/${group._id}` });
      created++;
    } catch (e) { log.error('Recurring expense failed', { rule: String(rule._id), err: e.message }); }
  }
  return created;
}

export function startScheduler() {
  const t = setInterval(() => runRecurringOnce().catch((e) => log.error('scheduler', { err: e.message })), 60_000);
  t.unref();
  return t;
}
