export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}
export const badRequest = (m, c, d) => new ApiError(400, m, c || 'BAD_REQUEST', d);
export const unauthorized = (m = 'Please sign in to continue', c = 'UNAUTHORIZED') => new ApiError(401, m, c);
export const forbidden = (m = 'You do not have permission to do that', c = 'FORBIDDEN') => new ApiError(403, m, c);
export const notFound = (m = 'Not found') => new ApiError(404, m, 'NOT_FOUND');
export const conflict = (m, c = 'CONFLICT') => new ApiError(409, m, c);
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
