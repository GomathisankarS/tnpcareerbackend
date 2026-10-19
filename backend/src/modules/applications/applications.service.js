import { transaction, query } from '../../db/pool.js';
import { findUser } from '../auth/auth.repository.js';
import { lockJob } from '../jobs/jobs.repository.js';
import { find as findProfile } from '../profiles/profiles.repository.js';
import { z, parse, idSchema, pageSchema, optionalText } from '../../shared/validation.js';
import { AppError } from '../../shared/errors/AppError.js';
import * as repo from './applications.repository.js';
export const list = (user, params) => repo.list(user, parse(pageSchema.strict(), params));
export const forJob = (user, job) => repo.forJob(user, parse(idSchema, job));
export async function apply(user, body) {
  const d = parse(z.object({ jobId: idSchema, coverNote: optionalText(2000) }).strict(), body);
  try {
    return await transaction(async (c) => {
      const u = await findUser(user, c, true);
      if (!u?.is_active || u.role !== 'candidate')
        throw new AppError('Account unavailable', 401, 'UNAUTHENTICATED');
      const job = await lockJob(d.jobId, c);
      const cat = job
        ? (await query('SELECT is_active FROM job_categories WHERE id=?', [job.category_id], c))[0]
        : null;
      if (!job || job.deleted_at || job.status !== 'published' || !cat?.is_active)
        throw new AppError('This job is no longer accepting applications', 409, 'JOB_UNAVAILABLE');
      if (await repo.forJob(user, d.jobId, c))
        throw new AppError('You have already applied for this job', 409, 'ALREADY_APPLIED');
      const profile = await findProfile(user, c, true);
      if (!profile)
        throw new AppError('Save your profile before applying', 409, 'PROFILE_REQUIRED');
      if (!profile.resume_storage_key)
        throw new AppError(
          'Add a PDF resume and save your profile before applying',
          409,
          'RESUME_REQUIRED'
        );
      return {
        id: await repo.insert(d.jobId, user, d.coverNote, profile, c),
        jobId: d.jobId,
        status: 'submitted'
      };
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      throw new AppError('You have already applied for this job', 409, 'ALREADY_APPLIED');
    throw e;
  }
}
