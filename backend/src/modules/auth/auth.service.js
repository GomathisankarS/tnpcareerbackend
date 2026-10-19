import { randomBytes, randomUUID, createHash } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { transaction } from '../../db/pool.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  z,
  parse,
  text,
  emailSchema,
  passwordSchema,
  normalizeMobile
} from '../../shared/validation.js';
import * as repository from './auth.repository.js';
const invalid = () => new AppError('Invalid or expired credentials', 401, 'UNAUTHENTICATED');
export const hashRefresh = (token) => createHash('sha256').update(token, 'ascii').digest();
export const newRefresh = () => randomBytes(32).toString('base64url');
export function accessToken(user) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.ACCESS_TTL_SECONDS
  });
}
export function verifyAccess(token) {
  try {
    const p = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE
    });
    if (!/^\d+$/.test(p.sub)) throw invalid();
    return Number(p.sub);
  } catch {
    throw invalid();
  }
}
export async function register(body) {
  const data = parse(
    z
      .object({
        fullName: text(100),
        email: emailSchema,
        mobileNumber: text(40),
        password: passwordSchema
      })
      .strict(),
    body
  );
  data.mobileNumber = normalizeMobile(data.mobileNumber);
  const hash = await argon2.hash(data.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
  try {
    return repository.safeUser(await repository.createUser(data, hash));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      throw new AppError('Email or mobile is already registered', 409, 'CONTACT_EXISTS');
    throw e;
  }
}
// A dummy hash equalizes missing-user password work. Never an account credential.
let dummy;
export async function login(body) {
  const data = parse(
    z
      .object({
        identifier: text(254),
        password: z.string().min(1).max(128),
        loginRole: z.enum(['candidate', 'admin']).optional()
      })
      .strict(),
    body
  );
  let column, value;
  if (data.identifier.includes('@')) {
    column = 'email';
    value = parse(emailSchema, data.identifier);
  } else {
    column = 'mobile_number';
    value = normalizeMobile(data.identifier);
  }
  const user = await repository.findContact(column, value);
  dummy ??= argon2.hash(randomBytes(32), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
  const valid = await argon2.verify(user?.password_hash || (await dummy), data.password);
  if (!valid || !user?.is_active) throw invalid();
  const checkLoginRole = (account) => {
    if (data.loginRole && account.role !== data.loginRole)
      throw new AppError(
        data.loginRole === 'candidate'
          ? 'This account is an administrator. Please use the admin login page.'
          : 'This account is a candidate. Please use the candidate login page.',
        403,
        'LOGIN_ROLE_MISMATCH'
      );
  };
  checkLoginRole(user);
  const refreshToken = newRefresh(),
    expires = new Date(Date.now() + env.REFRESH_TTL_SECONDS * 1000);
  const current = await transaction(async (c) => {
    const u = await repository.findUser(user.id, c, true);
    if (!u?.is_active) throw invalid();
    checkLoginRole(u);
    await repository.insertSession(u.id, randomUUID(), hashRefresh(refreshToken), expires, c);
    return u;
  });
  return {
    user: repository.safeUser(current),
    accessToken: accessToken(current),
    refreshToken,
    expires
  };
}
export async function refresh(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
  const hash = hashRefresh(token),
    initial = await repository.findSession(hash);
  if (!initial) throw invalid();
  const result = await transaction(async (c) => {
    const user = await repository.findUser(initial.user_id, c, true);
    const session = await repository.findSession(hash, c, true);
    if (!user?.is_active || !session || new Date(session.expires_at) <= new Date()) return null;
    if (session.rotated_at || session.revoked_at) {
      await repository.revokeFamily(session.family_id, c);
      return null;
    }
    const replacement = newRefresh();
    await repository.consumeSession(session.id, c);
    await repository.insertSession(
      user.id,
      session.family_id,
      hashRefresh(replacement),
      session.expires_at,
      c
    );
    return {
      user: repository.safeUser(user),
      accessToken: accessToken(user),
      refreshToken: replacement,
      expires: session.expires_at
    };
  });
  // Replay revocation has committed before the HTTP error is raised.
  if (!result) throw invalid();
  return result;
}
export async function logout(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const initial = await repository.findSession(hashRefresh(token));
  if (initial)
    await transaction(async (c) => {
      await repository.findUser(initial.user_id, c, true);
      const s = await repository.findSession(hashRefresh(token), c, true);
      if (s) await repository.revokeFamily(s.family_id, c);
    });
}
