import { NidRecord } from '../models/index.js';
import { encrypt, decrypt, blindIndex, maskNid } from '../lib/crypto.js';
import { conflict } from '../lib/errors.js';
import { z } from 'zod';

export const nidSchema = z.object({
  nidNumber: z.string().trim().transform((s) => s.replace(/[\s-]/g, '')).refine((s) => /^(\d{10}|\d{13}|\d{17})$/.test(s), 'NID must be 10, 13 or 17 digits'),
  nameOnNid: z.string().trim().min(3, 'Enter your name exactly as on your NID').max(100),
  dob: z.coerce.date().refine((d) => d < new Date(Date.now() - 18 * 365.25 * 864e5), 'You must be at least 18 years old').refine((d) => d.getFullYear() > 1900, 'Invalid date of birth'),
  fatherName: z.string().trim().max(100).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
});

export const nidView = (r) => r && ({
  status: r.status, masked: `••••••${r.last4}`, nameOnNid: r.nameOnNid, dob: r.dob, submittedAt: r.submittedAt,
  reason: r.status === 'rejected' ? r.reason : undefined, reviewedAt: r.reviewedAt,
});

/** Create or resubmit a user's NID record (encrypted at rest; one NID ↔ one account). */
export async function submitNid(userId, data) {
  const hash = blindIndex(data.nidNumber);
  const clash = await NidRecord.findOne({ hash }).select('user').lean();
  if (clash && String(clash.user) !== String(userId)) throw conflict('This NID is already linked to another Expensio account', 'NID_IN_USE');
  const existing = await NidRecord.findOne({ user: userId });
  if (existing?.status === 'approved') {
    if (existing.hash === hash) return existing;
    throw conflict('Your identity is already verified. Contact support to change it.', 'NID_LOCKED');
  }
  const fields = { hash, box: encrypt(data.nidNumber), last4: data.nidNumber.slice(-4), nameOnNid: data.nameOnNid, dob: data.dob, fatherName: data.fatherName, address: data.address, status: 'pending', reason: undefined, reviewedBy: undefined, reviewedAt: undefined, submittedAt: new Date() };
  return NidRecord.findOneAndUpdate({ user: userId }, { $set: fields, $setOnInsert: { user: userId } }, { upsert: true, new: true });
}
export { decrypt, maskNid };
