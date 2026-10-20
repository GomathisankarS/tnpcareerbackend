import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closePool } from './db/pool.js';

const server = app.listen(env.PORT, () => {
  logger.info(`TNP Job Portal API server running`, {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    frontendOrigin: env.FRONTEND_ORIGIN
  });
});

let isShuttingDown = false;

async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  // Force exit if cleanup takes longer than 5 seconds
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 5000);
  forceExitTimeout.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    logger.info('HTTP server closed cleanly.');

    await closePool();

    logger.info('Graceful shutdown completed successfully.');
    process.exit(exitCode);
  } catch (err) {
    logger.error('Error during graceful shutdown', { errorType: err.name });
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', () => {
  logger.error('process.unhandledRejection');
  gracefulShutdown('unhandledRejection', 1);
});
process.on('uncaughtException', () => {
  logger.error('process.uncaughtException');
  gracefulShutdown('uncaughtException', 1);
});
server.on('error', () => {
  logger.error('server.listenFailed');
  gracefulShutdown('listenError', 1);
});
export { server };
