import { transaction } from '../../db/pool.js';
import { parse, idSchema } from '../../shared/validation.js';
import { AppError } from '../../shared/errors/AppError.js';
import { jobSchema, filterSchema } from './jobs.validation.js';
import * as repo from './jobs.repository.js';
import { option } from '../catalog/catalog.repository.js';
const missing = () => new AppError('Job not found', 404, 'NOT_FOUND');
export const list = (filters, admin = false) => {
  const f = parse(filterSchema, filters);
  if (!admin && f.status) throw new AppError('Status filter is admin-only', 400, 'INVALID_FILTER');
  return repo.list(f, admin);
};
export async function detail(id, admin = false) {
  const job = await repo.detail(parse(idSchema, id), admin);
  if (!job) throw missing();
  return job;
}
export async function save(id, body, user) {
  const d = parse(jobSchema, body);
  const jobId = id ? parse(idSchema, id) : null;
  return transaction(async (c) => {
    const old = jobId ? await repo.lockJob(jobId, c) : null;
    if (jobId && (!old || old.deleted_at)) throw missing();
    const category = await repo.category(d.categoryId, c);
    if (!category || (!category.is_active && old?.category_id !== d.categoryId))
      throw new AppError('Select an active category', 400, 'VALIDATION_ERROR', [
        { field: 'categoryId', message: 'Category is unavailable' }
      ]);
    for (const [field, column] of Object.entries({
      employmentType: 'employment_type',
      workMode: 'work_mode',
      experienceLevel: 'experience_level'
    })) {
      const selected = await option(field, d[field], c);
      const unchanged = old?.[column] === d[field];
      if (!selected || (!selected.isActive && !unchanged))
        throw new AppError('Select an active option', 400, 'VALIDATION_ERROR', [
          { field, message: 'This option is unavailable' }
        ]);
      if (field === 'workMode' && selected.requiresCity && !d.locationCity)
        throw new AppError('City is required for this work mode', 400, 'VALIDATION_ERROR', [
          { field: 'locationCity', message: 'City is required' }
        ]);
    }
    const result = jobId || (await repo.create(d, user.id, c));
    if (jobId) await repo.update(jobId, d, old.published_at, c);
    return repo.detail(result, true, c);
  });
}
export async function remove(id) {
  return transaction(async (c) => {
    const jobId = parse(idSchema, id);
    const j = await repo.lockJob(jobId, c);
    if (!j || j.deleted_at) throw missing();
    await repo.remove(jobId, c);
  });
}
