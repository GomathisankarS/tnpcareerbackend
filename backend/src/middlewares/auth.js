import { env } from '../config/env.js';
import { verifyAccess } from '../modules/auth/auth.service.js';
import { findUser, safeUser } from '../modules/auth/auth.repository.js';
import { AppError } from '../shared/errors/AppError.js';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw new AppError('Please sign in', 401, 'UNAUTHENTICATED');
  const user = await findUser(verifyAccess(header.slice(7)));
  if (!user?.is_active) throw new AppError('Account unavailable', 401, 'UNAUTHENTICATED');
  req.user = safeUser(user);
  next();
});
export const authorize = (role) => (req, res, next) => {
  if (req.user?.role !== role)
    return next(new AppError('You do not have permission', 403, 'FORBIDDEN'));
  next();
};
export function trustedOrigin(req, res, next) {
  if (req.get('Origin') !== env.FRONTEND_ORIGIN)
    return next(new AppError('Untrusted request origin', 403, 'UNTRUSTED_ORIGIN'));
  next();
}
