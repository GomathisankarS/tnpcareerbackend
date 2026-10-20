import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { healthRoutes } from './modules/health/health.routes.js';
import cookieParser from 'cookie-parser';
import { authRoutes } from './modules/auth/auth.routes.js';
import { jobRoutes, adminJobRoutes } from './modules/jobs/jobs.routes.js';
import { categoryRoutes } from './modules/categories/categories.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { profileRoutes } from './modules/profiles/profiles.routes.js';
import { applicationRoutes } from './modules/applications/applications.routes.js';
import { optionRoutes, catalogRoutes } from './modules/catalog/catalog.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);

  app.use(helmet());

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
    })
  );

  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/job-options', optionRoutes);
  app.use('/api/admin/catalog', catalogRoutes);
  app.use('/api/admin/jobs', adminJobRoutes);
  app.use('/api/admin/dashboard', dashboardRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/applications', applicationRoutes);

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}

export const app = createApp();
