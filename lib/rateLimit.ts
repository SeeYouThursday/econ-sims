import { NextResponse } from 'next/server';
import { getRedisClient } from './redis';

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type MemoryCounter = {
  count: number;
  resetAt: number;
};

const memoryCounters = new Map<string, MemoryCounter>();
let cleanupCounter = 0;

declare global {
  var __econSimsRateLimitMemoryCounters: Map<string, MemoryCounter> | undefined;
}

function getMemoryCounters() {
  if (!globalThis.__econSimsRateLimitMemoryCounters) {
    globalThis.__econSimsRateLimitMemoryCounters = memoryCounters;
  }

  return globalThis.__econSimsRateLimitMemoryCounters;
}

function getWindowKey(key: string, windowSeconds: number, now: number) {
  const windowId = Math.floor(now / (windowSeconds * 1000));
  return `rate:${key}:${windowId}`;
}

function normalizePart(value: string) {
  // Simple normalization without expensive SHA256 hashing
  // Replace unsafe chars and limit length to prevent unbounded key growth
  return (value?.trim() || 'unknown')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
}

export function rateLimitKey(...parts: Array<string | null | undefined>) {
  return parts.map((part) => normalizePart(part || '')).join(':');
}

export function clientIpKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip =
    forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'local';

  // Fallback for development: if all local, use a more granular identifier
  // to avoid sharing rate limits across all clients in dev
  const finalIp =
    ip === 'local' ? `local-dev-${Math.random().toString(36).slice(2, 8)}` : ip;
  return rateLimitKey('ip', finalIp);
}

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt =
    Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000 +
    windowSeconds * 1000;
  const windowKey = getWindowKey(key, windowSeconds, now);

  try {
    const redis = await getRedisClient();
    if (redis) {
      const count = await redis.incr(windowKey);
      if (count === 1) {
        await redis.expire(windowKey, windowSeconds + 5);
      }

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(limit - count, 0),
        resetAt,
      };
    }
  } catch (error) {
    console.warn('[rate-limit] redis unavailable, using memory limiter', error);
  }

  const counters = getMemoryCounters();
  const existing = counters.get(windowKey);
  const next =
    existing && existing.resetAt > now
      ? { ...existing, count: existing.count + 1 }
      : { count: 1, resetAt };

  counters.set(windowKey, next);

  // Periodic cleanup every 100 operations to prevent memory growth
  cleanupCounter++;
  if (cleanupCounter % 100 === 0) {
    for (const [counterKey, counter] of counters) {
      if (counter.resetAt <= now) {
        counters.delete(counterKey);
      }
    }
  }

  return {
    allowed: next.count <= limit,
    limit,
    remaining: Math.max(limit - next.count, 0),
    resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(
    Math.ceil((result.resetAt - Date.now()) / 1000),
    1,
  );

  return NextResponse.json(
    {
      error: 'Too many requests. Please wait a moment before trying again.',
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        'Retry-After': String(retryAfter),
      },
    },
  );
}

export async function getCheckRateLimitResult(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  return checkRateLimit(options);
}

export async function enforceRateLimit(options: RateLimitOptions) {
  const result = await checkRateLimit(options);
  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}
