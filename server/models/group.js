import mongoose from 'mongoose';
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

const groupSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  emoji: { type: String, default: '🧳' },
  category: { type: String, enum: ['trip', 'home', 'event', 'friends', 'work', 'other'], default: 'trip' },
  description: { type: String, maxlength: 300, default: '' },
  destination: { type: String, maxlength: 120, default: '' },
  startDate: Date, endDate: Date,
  baseCurrency: { type: String, default: 'BDT' },
  simplifyDebts: { type: Boolean, default: true },
  createdBy: oid('User', { required: true }),
  members: [{ _id: false, user: oid('User'), role: { type: String, enum: ['admin', 'member'], default: 'member' }, joinedAt: { type: Date, default: Date.now }, active: { type: Boolean, default: true } }],
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });
groupSchema.index({ 'members.user': 1, status: 1, lastActivityAt: -1 });
export const Group = mongoose.model('Group', groupSchema);

const share = { _id: false, user: oid('User'), amountMinor: Number };
const expenseSchema = new Schema({
  group: oid('Group', { required: true, index: true }),
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, default: 'general' },
  note: { type: String, maxlength: 500, default: '' },
  date: { type: Date, default: Date.now, index: true },
  currency: { type: String, required: true },
  amountMinor: { type: Number, required: true },
  fxRate: { type: Number, default: 1 },
  baseCurrency: String,
  baseAmountMinor: { type: Number, required: true },
  splitType: { type: String, enum: ['equal', 'percent', 'shares', 'exact', 'itemized'], required: true },
  paid: [share], owed: [share],
  input: Schema.Types.Mixed, // the original request – lets us re-open the editor and re-run the engine
  createdBy: oid('User'),
  version: { type: Number, default: 1 },
  history: [{ _id: false, version: Number, at: Date, by: oid('User'), snapshot: Schema.Types.Mixed }],
  recurringRule: oid('RecurringRule'),
  deletedAt: Date, deletedBy: oid('User'),
}, { timestamps: true });
expenseSchema.index({ group: 1, deletedAt: 1, date: -1 });
export const Expense = mongoose.model('Expense', expenseSchema);

const settlementSchema = new Schema({
  group: oid('Group', { required: true, index: true }),
  from: oid('User', { required: true }), to: oid('User', { required: true }),
  amountMinor: { type: Number, required: true, min: 1 },
  currency: String,
  method: { type: String, enum: ['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank', 'Cash', 'Other'], default: 'Cash' },
  reference: { type: String, maxlength: 60, default: '' },
  note: { type: String, maxlength: 200, default: '' },
  status: { type: String, enum: ['pending', 'confirmed', 'rejected', 'cancelled'], default: 'pending', index: true },
  createdBy: oid('User'), respondedBy: oid('User'), respondedAt: Date,
}, { timestamps: true });
settlementSchema.index({ group: 1, status: 1, createdAt: -1 });
export const Settlement = mongoose.model('Settlement', settlementSchema);

const recurringSchema = new Schema({
  group: oid('Group', { required: true, index: true }),
  createdBy: oid('User', { required: true }),
  payload: Schema.Types.Mixed, // same shape as POST /expenses
  frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },
  nextRunAt: { type: Date, required: true, index: true },
  endAt: Date, active: { type: Boolean, default: true }, lastRunAt: Date, runCount: { type: Number, default: 0 },
}, { timestamps: true });
export const RecurringRule = mongoose.model('RecurringRule', recurringSchema);
