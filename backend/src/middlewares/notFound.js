import { sendError } from '../shared/utils/response.js';
export function notFoundHandler(req, res) {
  return sendError(res, `Resource not found: ${req.method} ${req.path}`, 404, 'NOT_FOUND');
}
