// Simple in-memory sliding-window rate limiter.
// Note: per-instance limits (adequate for V1; see docs/ARCHITEKTURA.md).

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const retryAfterMs = windowMs - (now - bucket.hits[0]);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  bucket.hits.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

// Occasional cleanup to keep memory bounded.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 60 * 60 * 1000) {
        buckets.delete(key);
      }
    }
  },
  10 * 60 * 1000,
).unref?.();
