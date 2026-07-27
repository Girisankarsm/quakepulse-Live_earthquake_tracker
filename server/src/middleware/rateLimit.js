const hits = new Map();

/**
 * Simple in-memory rate limiter (per IP).
 * Suitable for single-process deploys; swap for Redis in multi-instance.
 */
export function rateLimit({ windowMs = 60_000, max = 120 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = hits.get(ip);

    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(ip, bucket);
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res.status(429).json({
        error: true,
        message: 'Too many requests — slow down.',
        code: 'RATE_LIMITED',
      });
    }
    next();
  };
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of hits) {
    if (now - bucket.start > 120_000) hits.delete(ip);
  }
}, 60_000).unref?.();
