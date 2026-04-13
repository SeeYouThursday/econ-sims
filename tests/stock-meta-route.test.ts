import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('/api/stock/meta route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns company names from Polygon metadata when available', async () => {
    process.env.POLYGON_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { name: 'Apple Inc.' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { name: 'Microsoft Corporation' } }),
      } as Response);

    const route = await import('../app/api/stock/meta/route');
    const request = new Request(
      'http://localhost:3000/api/stock/meta?symbols=AAPL,MSFT',
    );

    const response = await route.GET(request as never);
    const payload = (await response.json()) as {
      symbols: Record<string, string>;
    };

    expect(payload.symbols.AAPL).toBe('Apple Inc.');
    expect(payload.symbols.MSFT).toBe('Microsoft Corporation');
  });

  it('falls back to deterministic ticker labels when upstream fails', async () => {
    process.env.POLYGON_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'upstream fail',
    } as Response);

    const route = await import('../app/api/stock/meta/route');
    const request = new Request(
      'http://localhost:3000/api/stock/meta?symbols=XYZ',
    );

    const response = await route.GET(request as never);
    const payload = (await response.json()) as {
      symbols: Record<string, string>;
    };

    expect(payload.symbols.XYZ).toBe('Ticker XYZ');
  });
});
