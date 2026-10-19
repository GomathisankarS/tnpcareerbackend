import { query } from '../../db/pool.js';
export const columns = {
  experienceLevel: 'experience_level',
  workMode: 'work_mode',
  employmentType: 'employment_type'
};
export async function list(kind, c) {
  if (kind === 'categories')
    return query(
      'SELECT c.id,c.name,c.slug AS code,c.is_active AS isActive,COUNT(j.id) AS jobCount FROM job_categories c LEFT JOIN jobs j ON j.category_id=c.id GROUP BY c.id ORDER BY c.name',
      [],
      c
    );
  return query(
    `SELECT o.id,o.name,o.code,o.is_active AS isActive,o.requires_city AS requiresCity,(SELECT COUNT(*) FROM jobs j WHERE j.${columns[kind]}=o.code) AS jobCount FROM job_options o WHERE o.kind=? ORDER BY o.id`,
    [kind],
    c
  );
}
export async function find(kind, id, c) {
  const sql =
    kind === 'categories'
      ? 'SELECT id,name,slug AS code,is_active AS isActive FROM job_categories WHERE id=? FOR UPDATE'
      : 'SELECT id,name,code,is_active AS isActive,requires_city AS requiresCity FROM job_options WHERE id=? AND kind=? FOR UPDATE';
  return (await query(sql, kind === 'categories' ? [id] : [id, kind], c))[0];
}
export async function option(kind, code, c) {
  return (
    await query(
      'SELECT code,is_active AS isActive,requires_city AS requiresCity FROM job_options WHERE kind=? AND code=? FOR UPDATE',
      [kind, code],
      c
    )
  )[0];
}
export async function save(kind, id, d, c) {
  if (kind === 'categories') {
    if (id)
      await query(
        'UPDATE job_categories SET name=?,is_active=? WHERE id=?',
        [d.name, d.isActive, id],
        c
      );
    else
      return (
        await query(
          'INSERT INTO job_categories(name,slug,is_active) VALUES (?,?,?)',
          [d.name, d.code, d.isActive],
          c
        )
      ).insertId;
  } else {
    if (id)
      await query(
        'UPDATE job_options SET name=?,is_active=?,requires_city=? WHERE id=? AND kind=?',
        [d.name, d.isActive, d.requiresCity, id, kind],
        c
      );
    else
      return (
        await query(
          'INSERT INTO job_options(kind,code,name,is_active,requires_city) VALUES (?,?,?,?,?)',
          [kind, d.code, d.name, d.isActive, d.requiresCity],
          c
        )
      ).insertId;
  }
  return id;
}
export async function usage(kind, row, c) {
  return (
    await query(
      `SELECT COUNT(*) AS total FROM jobs WHERE ${kind === 'categories' ? 'category_id' : columns[kind]}=?`,
      [kind === 'categories' ? row.id : row.code],
      c
    )
  )[0].total;
}
export async function remove(kind, id, c) {
  if (kind === 'categories') await query('DELETE FROM job_categories WHERE id=?', [id], c);
  else await query('DELETE FROM job_options WHERE id=? AND kind=?', [id, kind], c);
}
