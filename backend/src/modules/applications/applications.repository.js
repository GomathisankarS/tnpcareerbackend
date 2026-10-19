import { query } from '../../db/pool.js';
export async function forJob(user, job, c) {
  return (
    (
      await query(
        'SELECT id,job_id AS jobId,status,created_at AS createdAt FROM job_applications WHERE candidate_id=? AND job_id=?',
        [user, job],
        c
      )
    )[0] || null
  );
}
export async function insert(job, user, note, profile, c) {
  return (
    await query(
      'INSERT INTO job_applications (job_id,candidate_id,cover_note,resume_storage_key,resume_original_name,resume_size_bytes,resume_uploaded_at) VALUES (?,?,?,?,?,?,?)',
      [
        job,
        user,
        note,
        profile.resume_storage_key,
        profile.resume_original_name,
        profile.resume_size_bytes,
        profile.resume_uploaded_at
      ],
      c
    )
  ).insertId;
}
export async function list(user, { page, limit }) {
  const total = Number(
    (await query('SELECT COUNT(*) AS total FROM job_applications WHERE candidate_id=?', [user]))[0]
      .total
  );
  const rows = await query(
    'SELECT a.id,a.job_id AS jobId,j.title,j.company_name AS companyName,a.status,a.cover_note AS coverNote,a.created_at AS createdAt,a.resume_original_name AS resumeOriginalName,j.deleted_at AS jobDeletedAt,j.status AS jobStatus FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?',
    [user, limit, (page - 1) * limit]
  );
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
export async function find(id) {
  return (
    await query(
      'SELECT id,candidate_id,resume_storage_key,resume_original_name FROM job_applications WHERE id=?',
      [id]
    )
  )[0];
}
