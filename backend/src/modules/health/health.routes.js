import { Router } from 'express';
import { getHealthStatus, getDbHealthStatus } from './health.controller.js';

const router = Router();

// Liveness probe (no database dependency)
router.get('/', getHealthStatus);

// Readiness probe (executes SELECT 1 on MySQL)
router.get('/db', getDbHealthStatus);

export const healthRoutes = router;
