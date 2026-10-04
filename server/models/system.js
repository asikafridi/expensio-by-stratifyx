import mongoose from 'mongoose';
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

export const Invitation = mongoose.model('Invitation', new Schema({
  kind: { type: String, enum: ['group', 'business'], required: true },
  target: { type: Schema.Types.ObjectId, required: true, index: true },
  targetName: String,
  email: { type: String, lowercase: true, trim: true, required: true, index: true },
  invitedBy: oid('User', { required: true }),
  inviterName: String,
  role: { type: String, default: 'member' },
  ownershipBps: { type: Number, default: 0 },
  tokenHash: { type: String, unique: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'], default: 'pending', index: true },
  expiresAt: Date,
  acceptedBy: oid('User'),
}, { timestamps: true }));

const notifSchema = new Schema({
  user: oid('User', { required: true, index: true }),
  type: { type: String, default: 'info' },
  title: String, body: String, link: String,
  readAt: Date,
  createdAt: { type: Date, default: Date.now, index: { expires: 60 * 60 * 24 * 180 } },
});
notifSchema.index({ user: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', notifSchema);

const auditSchema = new Schema({
  actorType: { type: String, enum: ['user', 'staff', 'system'], default: 'user' },
  actor: oid('User'), actorEmail: String,
  action: { type: String, required: true, index: true },
  entityType: String, entityId: String,
  scope: { type: String, index: true }, // e.g. "business:<id>", "group:<id>", "platform"
  before: Schema.Types.Mixed, after: Schema.Types.Mixed,
  ip: String,
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });
// Immutable by design: block every mutation path.
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany', 'replaceOne'].forEach((op) =>
  auditSchema.pre(op, function blocked() { throw new Error('AuditLog is append-only'); }));
export const AuditLog = mongoose.model('AuditLog', auditSchema);

export const Ticket = mongoose.model('Ticket', new Schema({
  ref: { type: String, unique: true },
  user: oid('User'), name: String, email: { type: String, lowercase: true },
  subject: { type: String, maxlength: 140 }, category: { type: String, default: 'general' },
  status: { type: String, enum: ['open', 'pending', 'resolved'], default: 'open', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  assignee: oid('User'),
  messages: [{ _id: false, from: { type: String, enum: ['user', 'staff'] }, author: String, body: { type: String, maxlength: 4000 }, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));

export const Content = mongoose.model('Content', new Schema({
  slug: { type: String, unique: true, required: true },
  title: String, body: String, version: { type: Number, default: 1 },
  history: [{ _id: false, version: Number, title: String, body: String, editedBy: String, at: Date }],
  updatedBy: oid('User'),
}, { timestamps: true }));

export const FeatureFlag = mongoose.model('FeatureFlag', new Schema({
  key: { type: String, unique: true, required: true }, description: String,
  enabled: { type: Boolean, default: false }, updatedBy: oid('User'),
}, { timestamps: true }));

export const Setting = mongoose.model('Setting', new Schema({
  key: { type: String, unique: true, required: true }, value: Schema.Types.Mixed, updatedBy: oid('User'),
}, { timestamps: true }));
