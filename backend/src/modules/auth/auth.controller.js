import * as service from './auth.service.js';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../shared/utils/response.js';
export const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/api/auth'
};
const issue = (res, result) => {
  res.cookie('tnp_refresh', result.refreshToken, {
    ...cookieOptions,
    expires: new Date(result.expires)
  });
  return sendSuccess(res, { user: result.user, accessToken: result.accessToken });
};
export const register = async (req, res) => sendSuccess(res, await service.register(req.body), 201);
export const login = async (req, res) => issue(res, await service.login(req.body));
export async function refresh(req, res) {
  try {
    return issue(res, await service.refresh(req.cookies.tnp_refresh));
  } catch (e) {
    if (e.statusCode === 401) res.clearCookie('tnp_refresh', cookieOptions);
    throw e;
  }
}
export async function logout(req, res) {
  await service.logout(req.cookies.tnp_refresh);
  res.clearCookie('tnp_refresh', cookieOptions);
  return res.status(204).end();
}
export const me = (req, res) => sendSuccess(res, req.user);
