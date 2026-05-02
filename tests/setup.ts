/**
 * Global test setup — runs in every Vitest worker before any tests execute.
 *
 * Clears external service credentials so the test suite uses purely in-memory
 * state rather than hitting real Upstash Redis, Neon, or Clerk.
 *
 * This is necessary because .env.local (which holds real credentials) has
 * higher load priority than .env.test in Vitest's env file ordering, so
 * explicit process.env mutation here is the only reliable override.
 */

// ----- Redis (Upstash + node-redis) -----
process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = '';
process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.REDIS_URL = '';

// ----- Neon Postgres -----
process.env.DATABASE_URL = '';

// ----- Clerk -----
process.env.CLERK_SECRET_KEY = '';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = '';

// ----- Clear any cached Redis client globals -----
// lib/redis.ts caches the Upstash/node-redis clients on globalThis.
// Without clearing them, the real client (created during module warm-up)
// would be reused even after the env vars are blanked above.
delete (globalThis as Record<string, unknown>).__econSimsUpstashRedis;
delete (globalThis as Record<string, unknown>).__econSimsRedisClient;
delete (globalThis as Record<string, unknown>).__econSimsRedisConnectPromise;
delete (globalThis as Record<string, unknown>).__econSimsRateLimitMemoryCounters;
