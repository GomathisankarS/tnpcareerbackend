/**
 * Centralized response helpers for TNP Job Portal API.
 * Ensures consistent JSON structure across all endpoints.
 */

/**
 * Sends a successful JSON response.
 *
 * @param {import('express').Response} res
 * @param {any} data - Main response payload
 * @param {number} [statusCode=200] - HTTP status code
 * @param {object|null} [meta=null] - Optional pagination or metadata
 */
export function sendSuccess(res, data, statusCode = 200, meta = null) {
  const payload = {
    success: true,
    data
  };

  if (meta !== null && meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Sends a structured error JSON response.
 *
 * @param {import('express').Response} res
 * @param {string} message - Human-readable error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {string} [errorCode='INTERNAL_SERVER_ERROR'] - Machine-readable error code
 * @param {Array|object|null} [details=null] - Optional field-level or diagnostic details
 */
export function sendError(
  res,
  message,
  statusCode = 500,
  errorCode = 'INTERNAL_SERVER_ERROR',
  details = null
) {
  const payload = {
    success: false,
    error: {
      code: errorCode,
      message
    }
  };

  if (details !== null && details !== undefined) {
    payload.error.details = details;
  }

  if (res.req && res.req.id) {
    payload.requestId = res.req.id;
  }

  return res.status(statusCode).json(payload);
}
