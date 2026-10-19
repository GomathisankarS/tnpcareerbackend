import { transaction, query } from '../../db/pool.js';
import { z, parse, text, idSchema } from '../../shared/validation.js';
import { AppError } from '../../shared/errors/AppError.js';
import * as repo from './catalog.repository.js';
const kinds = z.enum(['categories', 'experienceLevel', 'workMode', 'employmentType']);
const schema = z
  .object({
    name: text(80),
    code: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    isActive: z.boolean(),
    requiresCity: z.boolean().nullable().optional()
  })
  .strict();
const categorySchema = schema.extend({
  code: z
    .string()
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
});
export const list = (kind) => repo.list(parse(kinds, kind));
export async function publicOptions() {
  const rows = await query(
    'SELECT kind,code,name,is_active AS isActive,requires_city AS requiresCity FROM job_options ORDER BY id'
  );
  return Object.fromEntries(
    ['experienceLevel', 'workMode', 'employmentType'].map((kind) => [
      kind,
      rows.filter((r) => r.kind === kind)
    ])
  );
}
export async function save(kind, id, body) {
  kind = parse(kinds, kind);
  const key = id ? parse(idSchema, id) : null;
  const d = parse(
    kind === 'categories'
      ? categorySchema
      : kind === 'workMode'
        ? schema.extend({ requiresCity: z.boolean().default(true) })
        : schema,
    body
  );
  // Accept legacy clients' booleans for other groups but never store a city rule there.
  if (kind !== 'workMode') d.requiresCity = null;
  try {
    return await transaction(async (c) => {
      const old = key ? await repo.find(kind, key, c) : null;
      if (key && !old) throw new AppError('Option not found', 404, 'NOT_FOUND');
      if (old && old.code !== d.code)
        throw new AppError(
          'Option codes cannot be changed; edit the display name instead',
          400,
          'VALIDATION_ERROR',
          [{ field: 'code', message: 'The code is permanent' }]
        );
      if (old && kind === 'workMode' && d.requiresCity && !old.requiresCity) {
        const invalid = await query(
          'SELECT id FROM jobs WHERE work_mode=? AND location_city IS NULL LIMIT 1',
          [old.code],
          c
        );
        if (invalid.length)
          throw new AppError(
            'Existing jobs using this work mode have no city. Update those jobs first.',
            409,
            'OPTION_IN_USE'
          );
      }
      const result = await repo.save(kind, key, d, c);
      return repo.find(kind, result, c);
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      throw new AppError('An option with this name or code already exists', 409, 'OPTION_EXISTS');
    throw e;
  }
}
export async function remove(kind, id) {
  kind = parse(kinds, kind);
  id = parse(idSchema, id);
  return transaction(async (c) => {
    const row = await repo.find(kind, id, c);
    if (!row) throw new AppError('Option not found', 404, 'NOT_FOUND');
    if (await repo.usage(kind, row, c))
      throw new AppError(
        'This option is used by jobs. Deactivate it instead to preserve existing jobs and applications.',
        409,
        'OPTION_IN_USE'
      );
    await repo.remove(kind, id, c);
  });
}
