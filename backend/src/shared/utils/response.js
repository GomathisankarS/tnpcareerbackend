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
