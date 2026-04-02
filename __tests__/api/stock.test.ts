import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helper to build a NextRequest with given search params
// ---------------------------------------------------------------------------
function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/stock');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

// ---------------------------------------------------------------------------
// We import the handler dynamically after setting env vars so the module-level
// constant POLYGON_API_KEY picks up the value.
// ---------------------------------------------------------------------------
describe('GET /api/stock', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns 500 when POLYGON_API_KEY is missing', async () => {
    delete process.env.POLYGON_API_KEY;
    const { GET } = await import('../../app/api/stock/route');
    const res = await GET(makeRequest({ symbol: 'AAPL', days: '30' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/POLYGON_API_KEY/);
  });

  it('returns 400 for an invalid symbol', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');
    const res = await GET(makeRequest({ symbol: '!!!', days: '30' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid symbol/);
  });

  it('clamps days to 7 when given a value below the minimum', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    const mockPolygonResponse = {
      results: [
        { t: Date.now(), o: 100, h: 110, l: 95, c: 105, v: 50000 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPolygonResponse,
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL', days: '1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
  });

  it('clamps days to 90 when given a value above the maximum', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL', days: '500' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(90);
  });

  it('defaults days to 30 when the parameter is not a number', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL', days: 'abc' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(30);
  });

  it('defaults symbol to AAPL when not provided', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as unknown as Response);

    const res = await GET(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.symbol).toBe('AAPL');
  });

  it('forwards Polygon API errors with the upstream status code', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Polygon API error');
    expect(body.details).toBe('Forbidden');
  });

  it('maps Polygon results to the expected candle shape', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    const ts = new Date('2024-06-01').getTime();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ t: ts, o: 180, h: 185, l: 178, c: 183, v: 75000 }],
      }),
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL', days: '30' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candles).toHaveLength(1);
    const candle = body.candles[0];
    expect(candle.date).toBe('2024-06-01');
    expect(candle.open).toBe(180);
    expect(candle.high).toBe(185);
    expect(candle.low).toBe(178);
    expect(candle.close).toBe(183);
    expect(candle.volume).toBe(75000);
  });

  it('returns an empty candles array when Polygon returns no results', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL', days: '30' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candles).toEqual([]);
  });

  it('sets the Cache-Control response header on success', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'AAPL', days: '30' }));
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('accepts symbols with dots (e.g. BRK.A)', async () => {
    process.env.POLYGON_API_KEY = 'test-key';
    const { GET } = await import('../../app/api/stock/route');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as unknown as Response);

    const res = await GET(makeRequest({ symbol: 'BRK.A', days: '30' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.symbol).toBe('BRK.A');
  });
});
