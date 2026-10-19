import * as service from './jobs.service.js';
import { sendSuccess } from '../../shared/utils/response.js';
export const list = (admin) => async (req, res) => {
  const r = await service.list(req.query, admin);
  return sendSuccess(res, r.data, 200, r.meta);
};
export const detail = (admin) => async (req, res) =>
  sendSuccess(res, await service.detail(req.params.id, admin));
export const create = async (req, res) =>
  sendSuccess(res, await service.save(null, req.body, req.user), 201);
export const update = async (req, res) =>
  sendSuccess(res, await service.save(req.params.id, req.body, req.user));
export const remove = async (req, res) => {
  await service.remove(req.params.id);
  res.status(204).end();
};
