import { Router } from 'express';
import { z } from 'zod';
import { Invitation, Group, Business, User, NidRecord } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../lib/validate.js';
import { wrap, forbidden, notFound, badRequest, conflict } from '../lib/errors.js';
import { sha256 } from '../lib/crypto.js';
import { submitNid, nidSchema } from '../services/kyc.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';

const pub = Router();
const r = Router();

// Public, minimal preview used by the invite landing page before sign-in.
pub.get('/invitations/preview/:token', wrap(async (req, res) => {
  const inv = await Invitation.findOne({ tokenHash: sha256(req.params.token) }).lean();
  if (!inv) throw notFound('This invitation link is not valid');
  const expired = inv.status !== 'pending' || inv.expiresAt < new Date();
  const exists = Boolean(await User.exists({ email: inv.email }));
  const mask = inv.email.replace(/^(.).*(@.*)$/, '$1•••$2');
  res.json({ kind: inv.kind, targetName: inv.targetName, inviterName: inv.inviterName, role: inv.role, ownershipPercent: inv.ownershipBps / 100, emailHint: mask, accountExists: exists, status: expired ? 'expired' : inv.status });
}));

r.use(authenticate);
const present = (i) => ({ id: i._id, kind: i.kind, targetName: i.targetName, inviterName: i.inviterName, role: i.role, ownershipPercent: i.ownershipBps / 100, status: i.status, expiresAt: i.expiresAt, createdAt: i.createdAt, needsNid: i.kind === 'business' });

r.get('/invitations', wrap(async (req, res) => {
  if (!req.user.emailVerified) return res.json({ invitations: [], needsVerification: true });
  const list = await Invitation.find({ email: req.user.email, status: 'pending', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  const hasNid = Boolean(await NidRecord.exists({ user: req.user.id }));
  res.json({ invitations: list.map(present), hasNid });
}));

r.get('/invitations/by-token/:token', wrap(async (req, res) => {
  const inv = await Invitation.findOne({ tokenHash: sha256(req.params.token) }).lean();
  if (!inv || inv.email !== req.user.email) throw notFound('This invitation belongs to a different email address. Sign in with the invited email.');
  res.json({ invitation: present(inv), hasNid: Boolean(await NidRecord.exists({ user: req.user.id })), verified: req.user.emailVerified });
}));

async function loadMine(req) {
  const inv = await Invitation.findById(req.params.id);
  if (!inv || inv.email !== req.user.email) throw notFound('Invitation not found');
  if (inv.status !== 'pending' || inv.expiresAt < new Date()) throw conflict('This invitation is no longer valid', 'INVITE_INACTIVE');
  return inv;
}

r.post('/invitations/:id/accept', validate(z.object({ nid: nidSchema.optional() })), wrap(async (req, res) => {
  if (!req.user.emailVerified) throw forbidden('Verify your email first', 'EMAIL_NOT_VERIFIED');
  const inv = await loadMine(req);
  let link;
  if (inv.kind === 'group') {
    const g = await Group.findById(inv.target);
    if (!g || g.status !== 'active') throw conflict('This group is no longer active');
    const m = g.members.find((x) => String(x.user) === req.user.id);
    if (m) m.active = true; else g.members.push({ user: req.user.id, role: 'member' });
    await g.save(); link = `/groups/${g._id}`;
    await notify(inv.invitedBy, { type: 'invite', category: 'invites', title: `${req.user.name} joined ${g.name}`, body: 'They accepted your invitation.', link });
  } else {
    // Business partners MUST have an identity record on file.
    const has = await NidRecord.exists({ user: req.user.id });
    if (!has) { if (!req.body.nid) throw badRequest('NID details are required to join a business', 'NID_REQUIRED'); await submitNid(req.user.id, req.body.nid); }
    const nid = await NidRecord.findOne({ user: req.user.id }).select('status').lean();
    if (nid.status === 'rejected') throw forbidden('Your identity submission was rejected. Update it in Settings → Identity.', 'NID_REJECTED');
    const biz = await Business.findById(inv.target);
    if (!biz || biz.status === 'closed') throw conflict('This business is no longer active');
    if (biz.partners.some((p) => String(p.user) === req.user.id)) throw conflict('You are already a partner');
    const inviter = biz.partners.find((p) => String(p.user) === String(inv.invitedBy) && p.role === 'owner');
    if (!inviter || inviter.ownershipBps < inv.ownershipBps) throw conflict('The inviter no longer has enough ownership to grant this share. Ask them to re-invite you.', 'OWNERSHIP_CHANGED');
    inviter.ownershipBps -= inv.ownershipBps;
    biz.partners.push({ user: req.user.id, role: inv.role, ownershipBps: inv.ownershipBps });
    await biz.save(); link = `/business/${biz._id}`;
    await audit(req, { action: 'business.partner_joined', scope: `business:${biz._id}`, entityType: 'user', entityId: req.user.id, after: { role: inv.role, ownershipBps: inv.ownershipBps } });
    await notify(inv.invitedBy, { type: 'invite', category: 'invites', email: true, title: `${req.user.name} joined ${biz.name}`, body: `They accepted as ${inv.role}. Their identity is pending review.`, link });
  }
  inv.status = 'accepted'; inv.acceptedBy = req.user.id; await inv.save();
  res.json({ ok: true, link });
}));

r.post('/invitations/:id/decline', wrap(async (req, res) => {
  const inv = await loadMine(req); inv.status = 'declined'; await inv.save();
  await notify(inv.invitedBy, { type: 'invite', category: 'invites', title: 'Invitation declined', body: `${req.user.name} declined the invitation to “${inv.targetName}”.` });
  res.json({ ok: true });
}));

export { pub as publicInvitations };
export default r;
