import { getLiveness, getDbReadiness } from './health.service.js';
import { sendSuccess } from '../../shared/utils/response.js';

/**
 * Controller for GET /api/health
 * Verifies HTTP server is responsive (no database dependency).
 */
export function getHealthStatus(req, res) {
  const data = getLiveness();
  return sendSuccess(res, data, 200);
}

/**
 * Controller for GET /api/health/db
 * Verifies live connection to configured MySQL database.
 */
export async function getDbHealthStatus(req, res, next) {
  try {
    const data = await getDbReadiness(req.id);
    return sendSuccess(res, data, 200);
  } catch (err) {
    return next(err);
  }
}
