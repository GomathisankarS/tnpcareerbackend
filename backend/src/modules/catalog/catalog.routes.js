import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { asyncHandler as a } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/response.js';
import * as service from './catalog.service.js';
export const optionRoutes = Router(),
  catalogRoutes = Router();
optionRoutes.get(
  '/',
  a(async (req, res) => sendSuccess(res, await service.publicOptions()))
);
catalogRoutes.use(authenticate, authorize('admin'));
catalogRoutes.get(
  '/:kind',
  a(async (req, res) => sendSuccess(res, await service.list(req.params.kind)))
);
catalogRoutes.post(
  '/:kind',
  a(async (req, res) => sendSuccess(res, await service.save(req.params.kind, null, req.body), 201))
);
catalogRoutes.put(
  '/:kind/:id',
  a(async (req, res) =>
    sendSuccess(res, await service.save(req.params.kind, req.params.id, req.body))
  )
);
catalogRoutes.delete(
  '/:kind/:id',
  a(async (req, res) => {
    await service.remove(req.params.kind, req.params.id);
    res.status(204).end();
  })
);
