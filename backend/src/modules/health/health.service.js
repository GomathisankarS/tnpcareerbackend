import { pingDb } from '../../db/pool.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logger } from '../../config/logger.js';

export function getLiveness() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  };
}

export async function getDbReadiness(requestId) {
  try {
    const isAlive = await pingDb();
    if (!isAlive) {
      throw new Error('Database ping query returned an empty result');
    }

    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Database readiness check failed', {
      requestId,
      errorName: err.name,
      errorCode: 'DATABASE_UNAVAILABLE'
    });

    throw new AppError('Database service is currently unavailable', 503, 'DATABASE_UNAVAILABLE');
  }
}
