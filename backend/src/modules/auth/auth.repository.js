import { query } from '../../db/pool.js';
const columns = 'id, full_name, email, mobile_number, password_hash, role, is_active';
export const safeUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  mobileNumber: u.mobile_number,
  role: u.role
});
export async function findUser(id, c, lock = false) {
  return (
    await query(`SELECT ${columns} FROM users WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], c)
  )[0];
}
export async function findContact(column, value, c) {
  if (!['email', 'mobile_number'].includes(column)) throw new Error('Invalid contact column');
  return (await query(`SELECT ${columns} FROM users WHERE ${column} = ?`, [value], c))[0];
}
export async function createUser(data, hash, role = 'candidate', c) {
  const result = await query(
    'INSERT INTO users (full_name,email,mobile_number,password_hash,role) VALUES (?,?,?,?,?)',
    [data.fullName, data.email, data.mobileNumber, hash, role],
    c
  );
  return findUser(result.insertId, c);
}
export async function findSession(hash, c, lock = false) {
  return (
    await query(
      `SELECT id,user_id,family_id,expires_at,rotated_at,revoked_at FROM auth_sessions WHERE refresh_token_hash = ?${lock ? ' FOR UPDATE' : ''}`,
      [hash],
      c
    )
  )[0];
}
export async function insertSession(userId, family, hash, expires, c) {
  await query(
    'INSERT INTO auth_sessions (user_id,family_id,refresh_token_hash,expires_at) VALUES (?,?,?,?)',
    [userId, family, hash, expires],
    c
  );
}
export async function revokeFamily(family, c) {
  await query(
    'UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(6)) WHERE family_id = ?',
    [family],
    c
  );
}
export async function consumeSession(id, c) {
  await query('UPDATE auth_sessions SET rotated_at = UTC_TIMESTAMP(6) WHERE id = ?', [id], c);
}
