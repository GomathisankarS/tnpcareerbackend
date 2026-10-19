import { transaction } from '../../db/pool.js';
import { findUser } from '../auth/auth.repository.js';
import { z, parse, text, integer, skillsSchema } from '../../shared/validation.js';
import { AppError } from '../../shared/errors/AppError.js';
import { storeResume, removeUnreferencedNewFile, resumeExists } from '../../shared/storage.js';
import * as repo from './profiles.repository.js';
import { logger } from '../../config/logger.js';
const schema = z
  .object({ currentCity: text(100), totalExperienceMonths: integer(0, 720), skills: skillsSchema })
  .strict();
export const get = async (id) => repo.mapProfile(await repo.find(id));
export async function save(id, body, file, multipart = false) {
  let input = body;
  if (multipart) {
    input = { ...body };
    if (
      typeof input.totalExperienceMonths === 'string' &&
      /^\d+$/.test(input.totalExperienceMonths)
    )
      input.totalExperienceMonths = Number(input.totalExperienceMonths);
    if (typeof input.skills === 'string') {
      try {
        input.skills = JSON.parse(input.skills);
      } catch {
        throw new AppError('Please check the highlighted fields', 400, 'VALIDATION_ERROR', [
          { field: 'skills', message: 'Skills must be a valid array' }
        ]);
      }
    }
  }
  const d = parse(schema, input);
  const metadata = file ? await storeResume(file) : null;
  try {
    return await transaction(async (c) => {
      const u = await findUser(id, c, true);
      if (!u?.is_active || u.role !== 'candidate')
        throw new AppError('Account unavailable', 401, 'UNAUTHENTICATED');
      const existing = await repo.find(id, c, true);
      if (!metadata) {
        if (!existing?.resume_storage_key)
          throw new AppError(
            'A PDF resume is required to save your profile',
            400,
            'RESUME_REQUIRED',
            [{ field: 'resume', message: 'Choose a PDF resume up to 5 MiB' }]
          );
        if (!(await resumeExists(existing.resume_storage_key))) {
          throw new AppError(
            'The saved resume is unavailable. Choose a replacement PDF.',
            400,
            'RESUME_REQUIRED',
            [{ field: 'resume', message: 'Choose a replacement PDF resume' }]
          );
        }
      }
      await repo.save(id, d, c);
      if (metadata) await repo.resume(id, metadata, c);
      return repo.mapProfile(await repo.find(id, c));
    });
  } catch (e) {
    if (metadata) {
      try {
        await removeUnreferencedNewFile(metadata.key);
      } catch {
        logger.error('upload.cleanupFailed');
      }
    }
    throw e;
  }
}
export async function upload(id, file) {
  const m = await storeResume(file);
  try {
    return await transaction(async (c) => {
      const u = await findUser(id, c, true);
      if (!u?.is_active || u.role !== 'candidate')
        throw new AppError('Account unavailable', 401, 'UNAUTHENTICATED');
      if (!(await repo.find(id, c, true)))
        throw new AppError('Save your profile before uploading a resume', 409, 'PROFILE_REQUIRED');
      await repo.resume(id, m, c);
      return repo.mapProfile(await repo.find(id, c));
    });
  } catch (e) {
    try {
      await removeUnreferencedNewFile(m.key);
    } catch {
      logger.error('upload.cleanupFailed');
    }
    throw e;
  }
}
