import { Redis as UpstashRedis } from '@upstash/redis';
import { createClient } from 'redis';

type EconSimsRedisClient = ReturnType<typeof createClient>;

type RedisAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<unknown>;
  setEx: (key: string, seconds: number, value: string) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  del: (key: string) => Promise<number>;
};

declare global {
  var __econSimsRedisClient: EconSimsRedisClient | undefined;
  var __econSimsRedisConnectPromise:
    | Promise<EconSimsRedisClient | null>
    | undefined;
  var __econSimsUpstashRedis: UpstashRedis | undefined;
}

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() ?? '';
}

function getUpstashUrl() {
  // Prefer the explicit KV REST API URL (https://), fall back to UPSTASH_REDIS_REST_URL.
  // Guard against accidentally receiving a rediss:// TCP URL — @upstash/redis needs https://.
  const candidates = [
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    process.env.UPSTASH_REDIS_REST_URL,
  ];
  for (const candidate of candidates) {
    const url = candidate?.trim() ?? '';
    if (url.startsWith('https://')) return url;
  }
  return '';
}

function getUpstashToken() {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN?.trim() ??
    ''
  );
}

function isUpstashConfigured() {
  return getUpstashUrl().length > 0 && getUpstashToken().length > 0;
}

export function isRedisConfigured() {
  return isUpstashConfigured() || getRedisUrl().length > 0;
}

function getUpstashAdapter(): RedisAdapter {
  if (!globalThis.__econSimsUpstashRedis) {
    globalThis.__econSimsUpstashRedis = new UpstashRedis({
      url: getUpstashUrl(),
      token: getUpstashToken(),
    });
  }

  const client = globalThis.__econSimsUpstashRedis;

  return {
    get: async (key: string) => {
      const value = await client.get<string | null>(key);
      return typeof value === 'string' ? value : null;
    },
    set: async (key: string, value: string) => {
      return client.set(key, value);
    },
    setEx: async (key: string, seconds: number, value: string) => {
      return client.set(key, value, { ex: seconds });
    },
    incr: async (key: string) => {
      const count = await client.incr(key);
      return typeof count === 'number' ? count : Number(count ?? 0);
    },
    expire: async (key: string, seconds: number) => {
      const result = await client.expire(key, seconds);
      return typeof result === 'number' ? result : result ? 1 : 0;
    },
    del: async (key: string) => {
      const deleted = await client.del(key);
      return typeof deleted === 'number' ? deleted : Number(deleted ?? 0);
    },
  };
}

function getNodeRedisAdapter(client: EconSimsRedisClient): RedisAdapter {
  return {
    get: (key: string) => client.get(key),
    set: (key: string, value: string) => client.set(key, value),
    setEx: (key: string, seconds: number, value: string) =>
      client.setEx(key, seconds, value),
    incr: (key: string) => client.incr(key),
    expire: (key: string, seconds: number) => client.expire(key, seconds),
    del: (key: string) => client.del(key),
  };
}

export async function getRedisClient(): Promise<RedisAdapter | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  if (isUpstashConfigured()) {
    return getUpstashAdapter();
  }

  if (globalThis.__econSimsRedisClient?.isOpen) {
    return getNodeRedisAdapter(globalThis.__econSimsRedisClient);
  }

  if (!globalThis.__econSimsRedisConnectPromise) {
    const client = createClient({
      url: getRedisUrl(),
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    client.on('error', (error) => {
      console.error('Redis connection error', error);
    });

    globalThis.__econSimsRedisConnectPromise = client
      .connect()
      .then(() => {
        globalThis.__econSimsRedisClient = client;
        return client;
      })
      .catch((error) => {
        globalThis.__econSimsRedisClient = undefined;
        globalThis.__econSimsRedisConnectPromise = undefined;
        console.error('Redis connect failed, using fallback storage', error);
        return null;
      });
  }

  const connectedClient = await globalThis.__econSimsRedisConnectPromise;
  if (!connectedClient) {
    return null;
  }

  return getNodeRedisAdapter(connectedClient);
}
