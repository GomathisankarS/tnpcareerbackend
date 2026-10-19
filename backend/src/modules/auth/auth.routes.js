import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { sendError } from '../../shared/utils/response.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { authenticate, trustedOrigin } from '../../middlewares/auth.js';
import * as c from './auth.controller.js';
export const authRoutes = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => sendError(res, 'Too many attempts. Try again later.', 429, 'RATE_LIMITED')
});
authRoutes.post('/register', limit, trustedOrigin, asyncHandler(c.register));
authRoutes.post('/login', limit, trustedOrigin, asyncHandler(c.login));
authRoutes.post('/refresh', trustedOrigin, asyncHandler(c.refresh));
authRoutes.post('/logout', trustedOrigin, asyncHandler(c.logout));
authRoutes.get('/me', authenticate, c.me);
