import { ZodError } from 'zod';
import { ApiError } from './errors.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  try { req[source] = schema.parse(req[source] ?? {}); next(); } catch (e) {
    if (e instanceof ZodError) {
      const fields = {};
      for (const i of e.issues) fields[i.path.join('.') || '_'] = i.message;
      return next(new ApiError(422, Object.values(fields)[0] || 'Invalid input', 'VALIDATION', fields));
    }
    next(e);
  }
};
