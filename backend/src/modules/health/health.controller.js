import { getLiveness, getDbReadiness } from './health.service.js';
import { sendSuccess } from '../../shared/utils/response.js';

export function getHealthStatus(req, res) {
  const data = getLiveness();
  return sendSuccess(res, data, 200);
}

export async function getDbHealthStatus(req, res, next) {
  try {
    const data = await getDbReadiness(req.id);
    return sendSuccess(res, data, 200);
  } catch (err) {
    return next(err);
  }
}
