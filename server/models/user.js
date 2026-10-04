import mongoose from 'mongoose';
const { Schema } = mongoose;

export const STAFF_ROLES = ['super_admin', 'kyc_reviewer', 'support', 'content_editor'];

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  emailVerified: { type: Boolean, default: false },
  phone: { type: String, trim: true, maxlength: 20, default: '' },
  mobileBanking: { provider: { type: String, enum: ['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank', 'Other', ''], default: '' }, number: { type: String, trim: true, maxlength: 24, default: '' } },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', ...STAFF_ROLES], default: 'user', index: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  avatar: { emoji: { type: String, default: '🙂' }, color: { type: String, default: '#0E7C7B' } },
  baseCurrency: { type: String, default: 'BDT' },
  tokenVersion: { type: Number, default: 0 },
  failedLogins: { type: Number, default: 0 },
  lockUntil: Date,
  verify: { tokenHash: String, codeHash: String, expiresAt: Date, attempts: { type: Number, default: 0 }, sentAt: Date },
  reset: { tokenHash: String, expiresAt: Date },
  otp: { hash: String, purpose: String, expiresAt: Date, attempts: { type: Number, default: 0 } },
  twoFactorEnabled: { type: Boolean, default: false },
  notificationPrefs: {
    activity: { type: Boolean, default: true },
    settlements: { type: Boolean, default: true },
    invites: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false },
  },
  onboardingDone: { type: Boolean, default: false },
  lastLoginAt: Date,
  lastLoginIp: String,
  deletionRequestedAt: Date,
}, { timestamps: true });

userSchema.methods.toSafe = function toSafe() {
  return {
    id: this._id, name: this.name, email: this.email, emailVerified: this.emailVerified, phone: this.phone,
    mobileBanking: this.mobileBanking, role: this.role, avatar: this.avatar, baseCurrency: this.baseCurrency,
    twoFactorEnabled: this.twoFactorEnabled, notificationPrefs: this.notificationPrefs,
    onboardingDone: this.onboardingDone, createdAt: this.createdAt, isStaff: STAFF_ROLES.includes(this.role),
  };
};
export const User = mongoose.model('User', userSchema);

const sessionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  tokenHash: { type: String, unique: true, required: true },
  userAgent: String, ip: String,
  expiresAt: { type: Date, index: { expires: 0 } },
  revokedAt: Date, replacedBy: String, lastUsedAt: Date,
}, { timestamps: true });
export const Session = mongoose.model('Session', sessionSchema);
