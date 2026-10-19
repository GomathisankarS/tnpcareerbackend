import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { asyncHandler as a } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { parse, idSchema } from '../../shared/validation.js';
import { AppError } from '../../shared/errors/AppError.js';
import { downloadResume } from '../../shared/storage.js';
import * as service from './applications.service.js';
import { find } from './applications.repository.js';
export const applicationRoutes = Router();
applicationRoutes.use(authenticate);
applicationRoutes.get(
  '/job/:jobId',
  authorize('candidate'),
  a(async (req, res) => sendSuccess(res, await service.forJob(req.user.id, req.params.jobId)))
);
applicationRoutes.get(
  '/',
  authorize('candidate'),
  a(async (req, res) => {
    const r = await service.list(req.user.id, req.query);
    return sendSuccess(res, r.data, 200, r.meta);
  })
);
applicationRoutes.post(
  '/',
  authorize('candidate'),
  a(async (req, res) => sendSuccess(res, await service.apply(req.user.id, req.body), 201))
);
applicationRoutes.get(
  '/:id/resume',
  a(async (req, res, next) => {
    const r = await find(parse(idSchema, req.params.id));
    if (
      !r ||
      (req.user.role !== 'admin' && r.candidate_id !== req.user.id) ||
      !r.resume_storage_key
    )
      throw new AppError('Resume unavailable', 404, 'NOT_FOUND');
    await downloadResume(res, r.resume_storage_key, r.resume_original_name, next);
  })
);
