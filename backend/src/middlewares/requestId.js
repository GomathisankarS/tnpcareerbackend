import { randomUUID } from 'node:crypto';
export function requestIdMiddleware(req, res, next) {
  const id = req.get('X-Request-Id');
  req.id = typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
