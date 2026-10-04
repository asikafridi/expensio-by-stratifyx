import mongoose from 'mongoose';
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

/** One identity record per user. NID number is encrypted (AES-256-GCM); only the last 4 digits are readable. */
const nidSchema = new Schema({
  user: oid('User', { required: true, unique: true }),
  hash: { type: String, required: true, unique: true }, // HMAC blind index → one NID can only back one account
  box: { iv: String, tag: String, data: String },
  last4: String,
  nameOnNid: { type: String, required: true },
  dob: { type: Date, required: true },
  fatherName: { type: String, default: '' },
  address: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: oid('User'), reviewedAt: Date, reason: String,
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const NidRecord = mongoose.model('NidRecord', nidSchema);

const businessSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['partnership', 'sole', 'company', 'other'], default: 'partnership' },
  description: { type: String, maxlength: 500, default: '' },
  tradeLicense: { type: String, maxlength: 60, default: '' },
  currency: { type: String, default: 'BDT' },
  createdBy: oid('User', { required: true }),
  partners: [{ _id: false, user: oid('User'), role: { type: String, enum: ['owner', 'partner', 'investor', 'accountant'], default: 'partner' }, ownershipBps: { type: Number, min: 0, max: 10000, default: 0 }, joinedAt: { type: Date, default: Date.now } }],
  status: { type: String, enum: ['active', 'flagged', 'closed'], default: 'active', index: true },
  flagReason: String,
}, { timestamps: true });
businessSchema.index({ 'partners.user': 1 });
export const Business = mongoose.model('Business', businessSchema);

const txnSchema = new Schema({
  business: oid('Business', { required: true, index: true }),
  partner: oid('User', { required: true }),
  type: { type: String, enum: ['investment', 'profit', 'expense', 'withdrawal'], required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  category: { type: String, maxlength: 40, default: '' },
  note: { type: String, maxlength: 300, default: '' },
  date: { type: Date, default: Date.now },
  createdBy: oid('User'),
  voidedAt: Date, voidedBy: oid('User'), voidReason: String,
}, { timestamps: true });
txnSchema.index({ business: 1, date: -1 });
export const BusinessTxn = mongoose.model('BusinessTxn', txnSchema);
