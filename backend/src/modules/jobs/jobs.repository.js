import { query } from '../../db/pool.js';
const fields = `j.id,j.category_id,j.created_by,j.title,j.company_name,j.location_city,j.employment_type,j.work_mode,j.experience_level,j.min_experience_months,j.max_experience_months,j.salary_min_annual_inr,j.salary_max_annual_inr,j.description,j.skills,j.is_featured,j.status,j.published_at,j.created_at,j.updated_at,c.name AS category_name,c.slug AS category_slug,et.name AS employment_type_name,wm.name AS work_mode_name,el.name AS experience_level_name`;
export function mapJob(r) {
  return {
    employmentTypeName: r.employment_type_name,
    workModeName: r.work_mode_name,
    experienceLevelName: r.experience_level_name,
    id: r.id,
    categoryId: r.category_id,
    categoryName: r.category_name,
    categorySlug: r.category_slug,
    title: r.title,
    companyName: r.company_name,
    locationCity: r.location_city,
    employmentType: r.employment_type,
    workMode: r.work_mode,
    experienceLevel: r.experience_level,
    minExperienceMonths: r.min_experience_months,
    maxExperienceMonths: r.max_experience_months,
    salaryMinAnnualInr: r.salary_min_annual_inr === null ? null : Number(r.salary_min_annual_inr),
    salaryMaxAnnualInr: r.salary_max_annual_inr === null ? null : Number(r.salary_max_annual_inr),
    description: r.description,
    skills: typeof r.skills === 'string' ? JSON.parse(r.skills) : r.skills,
    isFeatured: !!r.is_featured,
    status: r.status,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
export function buildFilters(f, admin = false) {
  const where = ['j.deleted_at IS NULL'];
  const values = [];
  if (!admin) where.push("j.status = 'published'", 'c.is_active = 1');
  else if (f.status) {
    where.push('j.status = ?');
    values.push(f.status);
  }
  for (const [key, col] of Object.entries({
    categoryId: 'category_id',
    experienceLevel: 'experience_level',
    employmentType: 'employment_type',
    workMode: 'work_mode',
    city: 'location_city'
  }))
    if (f[key] !== undefined) {
      where.push(`j.${col} = ?`);
      values.push(f[key]);
    }
  if (f.featured !== undefined) {
    where.push('j.is_featured = ?');
    values.push(f.featured === 'true' ? 1 : 0);
  }
  if (f.q) {
    where.push(
      "(j.title LIKE ? ESCAPE '!' OR j.company_name LIKE ? ESCAPE '!' OR j.description LIKE ? ESCAPE '!')"
    );
    const q = `%${f.q.replace(/[!%_]/g, '!$&')}%`;
    values.push(q, q, q);
  }
  return { sql: where.join(' AND '), values };
}
export async function list(f, admin) {
  const { sql, values } = buildFilters(f, admin);
  const from = `FROM jobs j JOIN job_categories c ON c.id=j.category_id LEFT JOIN job_options et ON et.kind='employmentType' AND et.code=j.employment_type LEFT JOIN job_options wm ON wm.kind='workMode' AND wm.code=j.work_mode LEFT JOIN job_options el ON el.kind='experienceLevel' AND el.code=j.experience_level WHERE ${sql}`;
  const total = (await query(`SELECT COUNT(*) AS total ${from}`, values))[0].total;
  const order =
    f.sort === 'salary'
      ? 'j.salary_max_annual_inr DESC,j.id DESC'
      : 'j.published_at DESC,j.id DESC';
  const rows = await query(`SELECT ${fields} ${from} ORDER BY ${order} LIMIT ? OFFSET ?`, [
    ...values,
    f.limit,
    (f.page - 1) * f.limit
  ]);
  return {
    data: rows.map(mapJob),
    meta: {
      page: f.page,
      limit: f.limit,
      total: Number(total),
      totalPages: Math.ceil(total / f.limit)
    }
  };
}
export async function detail(id, admin = false, c) {
  const rows = await query(
    `SELECT ${fields} FROM jobs j JOIN job_categories c ON c.id=j.category_id LEFT JOIN job_options et ON et.kind='employmentType' AND et.code=j.employment_type LEFT JOIN job_options wm ON wm.kind='workMode' AND wm.code=j.work_mode LEFT JOIN job_options el ON el.kind='experienceLevel' AND el.code=j.experience_level WHERE j.id=? AND j.deleted_at IS NULL ${admin ? '' : "AND j.status='published' AND c.is_active=1"}`,
    [id],
    c
  );
  return rows[0] ? mapJob(rows[0]) : null;
}
export async function lockJob(id, c) {
  return (
    await query(
      'SELECT id,category_id,status,deleted_at,published_at,employment_type,work_mode,experience_level FROM jobs WHERE id=? FOR UPDATE',
      [id],
      c
    )
  )[0];
}
export async function category(id, c) {
  return (await query('SELECT id,is_active FROM job_categories WHERE id=? FOR UPDATE', [id], c))[0];
}
const values = (d) => [
  d.categoryId,
  d.title,
  d.companyName,
  d.locationCity,
  d.employmentType,
  d.workMode,
  d.experienceLevel,
  d.minExperienceMonths,
  d.maxExperienceMonths,
  d.salaryMinAnnualInr,
  d.salaryMaxAnnualInr,
  d.description,
  JSON.stringify(d.skills),
  d.isFeatured,
  d.status
];
export async function create(d, user, c) {
  return (
    await query(
      'INSERT INTO jobs (category_id,title,company_name,location_city,employment_type,work_mode,experience_level,min_experience_months,max_experience_months,salary_min_annual_inr,salary_max_annual_inr,description,skills,is_featured,status,created_by,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [...values(d), user, d.status === 'draft' ? null : new Date()],
      c
    )
  ).insertId;
}
export async function update(id, d, publishedAt, c) {
  await query(
    'UPDATE jobs SET category_id=?,title=?,company_name=?,location_city=?,employment_type=?,work_mode=?,experience_level=?,min_experience_months=?,max_experience_months=?,salary_min_annual_inr=?,salary_max_annual_inr=?,description=?,skills=?,is_featured=?,status=?,published_at=? WHERE id=?',
    [...values(d), publishedAt || (d.status === 'draft' ? null : new Date()), id],
    c
  );
}
export async function remove(id, c) {
  await query('UPDATE jobs SET deleted_at=UTC_TIMESTAMP(6) WHERE id=?', [id], c);
}
