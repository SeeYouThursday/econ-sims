import { beforeEach, describe, expect, it, vi } from 'vitest';

function symbolForIndex(index: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const first = letters[index % letters.length];
  const second = letters[Math.floor(index / letters.length) % letters.length];
  const third =
    letters[Math.floor(index / (letters.length * letters.length)) % letters.length];

  return `T${third}${second}${first}`;
}

describe('/api/stock rate limiting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv('POLYGON_API_KEY', 'test-key');
    delete (globalThis as Record<string, unknown>)
      .__econSimsRateLimitMemoryCounters;
  });

  it('rate limits stock history lookups across varied symbols by IP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ t: Date.UTC(2026, 3, 29), o: 1, h: 2, l: 1, c: 2, v: 100 }],
      }),
    } as Response);

    const route = await import('../app/api/stock/route');

    for (let index = 0; index < 240; index += 1) {
      const response = await route.GET(
        new Request(
          `http://localhost/api/stock?symbol=${symbolForIndex(index)}&days=30`,
          { headers: { 'x-forwarded-for': '203.0.113.12' } },
        ) as never,
      );

      expect(response.status).toBe(200);
    }

    const blocked = await route.GET(
      new Request('http://localhost/api/stock?symbol=ZZZZ&days=30', {
        headers: { 'x-forwarded-for': '203.0.113.12' },
      }) as never,
    );

    expect(blocked.status).toBe(429);
    expect(globalThis.fetch).toHaveBeenCalledTimes(240);
  });
});
