import { AuditLog } from '../models/index.js';
import { log } from '../lib/logger.js';

/** Append-only audit trail. Never blocks or breaks the request if logging fails. */
export async function audit(req, { action, scope = 'platform', entityType, entityId, before, after, actorType }) {
  try {
    await AuditLog.create({
      actorType: actorType || (req?.user?.isStaff ? 'staff' : req?.user ? 'user' : 'system'),
      actor: req?.user?.id, actorEmail: req?.user?.email,
      action, scope, entityType, entityId: entityId ? String(entityId) : undefined, before, after, ip: req?.ip,
    });
  } catch (e) { log.error('audit failed', { action, err: e.message }); }
}
