import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { asyncHandler as a } from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../shared/utils/response.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';
import { downloadResume } from '../../shared/storage.js';
import * as service from './profiles.service.js';
import { find } from './profiles.repository.js';
export const profileRoutes = Router();
profileRoutes.use(authenticate, authorize('candidate'));
profileRoutes.get(
  '/',
  a(async (req, res) => sendSuccess(res, await service.get(req.user.id)))
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.RESUME_MAX_BYTES, files: 1, fields: 0, parts: 2 }
});
const limit = rateLimit({
  windowMs: 60000,
  limit: 10,
  legacyHeaders: false,
  handler: (req, res) => sendError(res, 'Try the upload again later', 429, 'RATE_LIMITED')
});
const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.RESUME_MAX_BYTES, files: 1, fields: 3, parts: 5, fieldSize: 16384 }
});
profileRoutes.put(
  '/',
  limit,
  profileUpload.single('resume'),
  a(async (req, res) =>
    sendSuccess(
      res,
      await service.save(req.user.id, req.body, req.file, !!req.is('multipart/form-data'))
    )
  )
);
profileRoutes.post(
  '/resume',
  limit,
  upload.single('resume'),
  a(async (req, res) => sendSuccess(res, await service.upload(req.user.id, req.file)))
);
profileRoutes.get(
  '/resume',
  a(async (req, res, next) => {
    const p = await find(req.user.id);
    if (!p?.resume_storage_key) throw new AppError('No resume uploaded', 404, 'NOT_FOUND');
    await downloadResume(res, p.resume_storage_key, p.resume_original_name, next);
  })
);
