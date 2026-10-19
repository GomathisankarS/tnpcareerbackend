import { AppError } from '../shared/errors/AppError.js';
import { sendError } from '../shared/utils/response.js';
import { logger } from '../config/logger.js';
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE')
    return sendError(res, 'Request exceeds the allowed size', 413, 'PAYLOAD_TOO_LARGE');
  if (err.type === 'entity.parse.failed')
    return sendError(res, 'Malformed JSON payload in request body', 400, 'INVALID_JSON');
  if (['encoding.unsupported', 'charset.unsupported'].includes(err.type))
    return sendError(res, 'Unsupported request encoding', 415, 'UNSUPPORTED_ENCODING');
  if (err.code?.startsWith('LIMIT_'))
    return sendError(res, 'Upload one PDF file in the resume field', 400, 'INVALID_UPLOAD');
  if (err.code === 'ER_DUP_ENTRY')
    return sendError(res, 'This record already exists', 409, 'CONFLICT');
  if (err instanceof AppError)
    return sendError(res, err.message, err.statusCode, err.errorCode, err.details);
  logger.error('request.failed', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    errorType: err.name
  });
  return sendError(
    res,
    'An unexpected internal server error occurred',
    500,
    'INTERNAL_SERVER_ERROR'
  );
}
