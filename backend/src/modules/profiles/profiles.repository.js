import { query } from '../../db/pool.js';
const columns =
  'user_id,current_city,total_experience_months,skills,resume_storage_key,resume_original_name,resume_size_bytes,resume_uploaded_at';
export async function find(userId, c, lock = false) {
  return (
    await query(
      `SELECT ${columns} FROM candidate_profiles WHERE user_id=?${lock ? ' FOR UPDATE' : ''}`,
      [userId],
      c
    )
  )[0];
}
export function mapProfile(p) {
  return p
    ? {
        currentCity: p.current_city,
        totalExperienceMonths: p.total_experience_months,
        skills: typeof p.skills === 'string' ? JSON.parse(p.skills) : p.skills,
        resume: p.resume_storage_key
          ? {
              originalName: p.resume_original_name,
              sizeBytes: p.resume_size_bytes,
              uploadedAt: p.resume_uploaded_at
            }
          : null
      }
    : null;
}
export async function save(id, d, c) {
  await query(
    'INSERT INTO candidate_profiles (user_id,current_city,total_experience_months,skills) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE current_city=VALUES(current_city),total_experience_months=VALUES(total_experience_months),skills=VALUES(skills)',
    [id, d.currentCity, d.totalExperienceMonths, JSON.stringify(d.skills)],
    c
  );
}
export async function resume(id, m, c) {
  await query(
    'UPDATE candidate_profiles SET resume_storage_key=?,resume_original_name=?,resume_size_bytes=?,resume_uploaded_at=? WHERE user_id=?',
    [m.key, m.name, m.size, m.time, id],
    c
  );
}
