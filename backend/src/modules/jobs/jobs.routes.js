import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { asyncHandler as a } from '../../shared/utils/asyncHandler.js';
import * as c from './jobs.controller.js';
export const jobRoutes = Router(),
  adminJobRoutes = Router();
jobRoutes.get('/', a(c.list(false)));
jobRoutes.get('/:id', a(c.detail(false)));
adminJobRoutes.use(authenticate, authorize('admin'));
adminJobRoutes.get('/', a(c.list(true)));
adminJobRoutes.post('/', a(c.create));
adminJobRoutes.get('/:id', a(c.detail(true)));
adminJobRoutes.put('/:id', a(c.update));
adminJobRoutes.delete('/:id', a(c.remove));
