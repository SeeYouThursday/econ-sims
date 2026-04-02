import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

describe('/api/fed-start route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete (
      globalThis as typeof globalThis & { __fedStartCacheState?: unknown }
    ).__fedStartCacheState;
  });

  afterEach(() => {
    delete process.env.FRED_API_KEY;
  });

  it('returns fallback payload when FRED_API_KEY is missing', async () => {
    delete process.env.FRED_API_KEY;
    const route = await import('../app/api/fed-start/route');

    const response = await route.GET();
    const payload = (await response.json()) as {
      inflation: number;
      unemployment: number;
      interestRate: number;
      source: string;
    };

    expect(payload.inflation).toBe(2.0);
    expect(payload.unemployment).toBe(5.0);
    expect(payload.interestRate).toBe(4.0);
    expect(payload.source).toContain('missing FRED_API_KEY');
  });

  it('returns FRED payload when upstream requests succeed', async () => {
    process.env.FRED_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [
            { date: '2026-03-01', value: '300.0' },
            { date: '2026-02-01', value: '299.5' },
            { date: '2026-01-01', value: '298.0' },
            { date: '2025-12-01', value: '297.0' },
            { date: '2025-11-01', value: '296.0' },
            { date: '2025-10-01', value: '295.5' },
            { date: '2025-09-01', value: '295.0' },
            { date: '2025-08-01', value: '294.2' },
            { date: '2025-07-01', value: '293.8' },
            { date: '2025-06-01', value: '293.1' },
            { date: '2025-05-01', value: '292.6' },
            { date: '2025-04-01', value: '292.0' },
            { date: '2025-03-01', value: '290.0' },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [{ date: '2026-03-01', value: '3.9' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [{ date: '2026-03-01', value: '5.25' }],
        }),
      } as Response);

    const route = await import('../app/api/fed-start/route');
    const response = await route.GET();
    const payload = (await response.json()) as {
      inflation: number;
      unemployment: number;
      interestRate: number;
      source: string;
      asOf: string;
    };

    expect(payload.inflation).toBe(3.45);
    expect(payload.unemployment).toBe(3.9);
    expect(payload.interestRate).toBe(5.25);
    expect(payload.source).toBe('FRED');
    expect(payload.asOf).toContain('2026-03-01');
  });
});
