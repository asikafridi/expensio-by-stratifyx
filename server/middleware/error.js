import { ApiError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { config } from '../config/env.js';

export const notFoundApi = (_req, res) => res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError || err?.status && err.status < 500 && err.name !== 'MongoServerError') {
    return res.status(err.status || 400).json({ error: err.message, code: err.code || err.name, details: err.details });
  }
  if (err?.name === 'ValidationError') return res.status(422).json({ error: Object.values(err.errors)[0]?.message || 'Invalid data', code: 'VALIDATION' });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier', code: 'BAD_REQUEST' });
  if (err?.code === 11000) return res.status(409).json({ error: 'That record already exists', code: 'DUPLICATE' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large', code: 'TOO_LARGE' });
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Malformed JSON', code: 'BAD_REQUEST' });
  log.error(`${req.method} ${req.originalUrl} → ${err?.stack || err}`);
  return res.status(500).json({ error: config.isProd ? 'Something went wrong on our side. Please try again.' : String(err?.message || err), code: 'INTERNAL' });
}
