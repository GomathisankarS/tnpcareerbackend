import { Router } from 'express';
import { getHealthStatus, getDbHealthStatus } from './health.controller.js';

const router = Router();

router.get('/', getHealthStatus);

router.get('/db', getDbHealthStatus);

export const healthRoutes = router;
