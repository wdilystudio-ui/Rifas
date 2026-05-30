const buckets = new Map();

function getIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return String(forwardedFor).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export function checkRateLimit(req, key, { limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const ip = getIp(req);
  const bucketKey = `${key}:${ip}`;
  const bucket = buckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}
