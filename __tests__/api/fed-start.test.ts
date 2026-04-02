import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the module-level cache stored in globalThis between tests. */
function resetCache() {
  (globalThis as Record<string, unknown>).__fedStartCacheState = undefined;
}

function makeFredResponse(values: string[], dates?: string[]) {
  return {
    observations: values.map((value, i) => ({
      value,
      date: dates?.[i] ?? `2024-${String(i + 1).padStart(2, '0')}-01`,
    })),
  };
}

const VALID_FRED_DATA = {
  inflation: {
    // 13 observations: CPI YoY = (latest / prior_year - 1) * 100
    observations: Array.from({ length: 13 }, (_, i) => ({
      value: String(300 + i),
      date: `2024-${String(13 - i).padStart(2, '0')}-01`,
    })),
  },
  unemployment: makeFredResponse(['4.2'], ['2024-01-01']),
  interestRate: makeFredResponse(['5.25'], ['2024-01-01']),
};

describe('GET /api/fed-start', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetCache();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // -------------------------------------------------------------------------
  // No API key
  // -------------------------------------------------------------------------
  it('returns fallback payload when FRED_API_KEY is missing', async () => {
    delete process.env.FRED_API_KEY;
    const { GET } = await import('../../app/api/fed-start/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toMatch(/fallback/);
    expect(typeof body.inflation).toBe('number');
    expect(typeof body.unemployment).toBe('number');
    expect(typeof body.interestRate).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Successful live fetch
  // -------------------------------------------------------------------------
  it('returns live FRED data on a successful fetch', async () => {
    process.env.FRED_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/fed-start/route');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      const responses = [
        VALID_FRED_DATA.inflation,
        VALID_FRED_DATA.unemployment,
        VALID_FRED_DATA.interestRate,
      ];
      return Promise.resolve({
        ok: true,
        json: async () => responses[callCount++ % 3],
      });
    }) as unknown as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('FRED');
    expect(typeof body.inflation).toBe('number');
    expect(typeof body.unemployment).toBe('number');
    expect(typeof body.interestRate).toBe('number');
    expect(body.asOf).toContain('/');
  });

  // -------------------------------------------------------------------------
  // FRED API error → fallback
  // -------------------------------------------------------------------------
  it('returns fallback when FRED fetch fails and there is no cached data', async () => {
    process.env.FRED_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/fed-start/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toMatch(/fallback/);
  });

  // -------------------------------------------------------------------------
  // Caching: second call hits fresh cache
  // -------------------------------------------------------------------------
  it('returns cached result on a second call without re-fetching', async () => {
    process.env.FRED_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/fed-start/route');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      const responses = [
        VALID_FRED_DATA.inflation,
        VALID_FRED_DATA.unemployment,
        VALID_FRED_DATA.interestRate,
      ];
      return Promise.resolve({
        ok: true,
        json: async () => responses[callCount++ % 3],
      });
    }) as unknown as typeof fetch;

    // Warm the cache
    await GET();
    const fetchCallsAfterFirst = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // Second call should be served from cache
    const res2 = await GET();
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.source).toBe('FRED');
    // No additional fetch calls beyond the first round
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCallsAfterFirst);
  });

  // -------------------------------------------------------------------------
  // parseLatestObservation: missing observations
  // -------------------------------------------------------------------------
  it('returns fallback when FRED returns empty observations', async () => {
    process.env.FRED_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/fed-start/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ observations: [] }),
    } as unknown as Response);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toMatch(/fallback/);
  });

  // -------------------------------------------------------------------------
  // Not enough CPI observations (< 13)
  // -------------------------------------------------------------------------
  it('returns fallback when there are fewer than 13 CPI observations', async () => {
    process.env.FRED_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/fed-start/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeFredResponse(['300', '299'], ['2024-01-01', '2023-12-01']),
    } as unknown as Response);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toMatch(/fallback/);
  });

  // -------------------------------------------------------------------------
  // Cache-Control header
  // -------------------------------------------------------------------------
  it('includes Cache-Control header on a successful response', async () => {
    process.env.FRED_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/fed-start/route');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      const responses = [
        VALID_FRED_DATA.inflation,
        VALID_FRED_DATA.unemployment,
        VALID_FRED_DATA.interestRate,
      ];
      return Promise.resolve({
        ok: true,
        json: async () => responses[callCount++ % 3],
      });
    }) as unknown as typeof fetch;

    const res = await GET();
    expect(res.headers.get('Cache-Control')).toContain('s-maxage');
  });
});
