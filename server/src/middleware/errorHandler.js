export function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.name === 'FetchError' ? 502 : 500);
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unexpected error';

  if (status >= 500) {
    console.error(`[error] ${err.message}`, err.cause || '');
  }

  const code =
    err.code ||
    (status === 400
      ? 'BAD_REQUEST'
      : status === 429
        ? 'RATE_LIMITED'
        : status === 502
          ? 'UPSTREAM_ERROR'
          : 'SERVER_ERROR');

  res.status(status).json({
    error: true,
    message,
    code,
  });
}

export function notFound(_req, res) {
  res.status(404).json({ error: true, message: 'Not found', code: 'NOT_FOUND' });
}
