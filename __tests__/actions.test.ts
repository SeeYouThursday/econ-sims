import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchStockData, fetchFedStartData } from '../actions';

// ---------------------------------------------------------------------------
// fetchStockData
// ---------------------------------------------------------------------------
describe('fetchStockData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed payload on a successful response', async () => {
    const mockPayload = {
      symbol: 'AAPL',
      days: 30,
      from: '2024-01-01',
      to: '2024-01-31',
      candles: [
        {
          date: '2024-01-02',
          open: 185,
          high: 188,
          low: 184,
          close: 187,
          volume: 1000000,
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as unknown as Response);

    const result = await fetchStockData('AAPL', 30);
    expect(result).toEqual(mockPayload);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/stock?symbol=AAPL&days=30',
    );
  });

  it('trims and uppercases the symbol before fetching', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'MSFT', days: 30, from: '', to: '', candles: [] }),
    } as unknown as Response);

    await fetchStockData('  msft  ', 30);
    expect(global.fetch).toHaveBeenCalledWith('/api/stock?symbol=MSFT&days=30');
  });

  it('throws when the response is not ok and uses the error field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Symbol not found.' }),
    } as unknown as Response);

    await expect(fetchStockData('INVALID', 30)).rejects.toThrow('Symbol not found.');
  });

  it('throws with a fallback message when error payload has no error field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as unknown as Response);

    await expect(fetchStockData('INVALID', 30)).rejects.toThrow(
      'Unable to load stock prices.',
    );
  });

  it('throws with a fallback message when response body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new SyntaxError('not json'); },
    } as unknown as Response);

    await expect(fetchStockData('INVALID', 30)).rejects.toThrow(
      'Unable to load stock prices.',
    );
  });

  it('uses default days=30 when not provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'AAPL', days: 30, from: '', to: '', candles: [] }),
    } as unknown as Response);

    await fetchStockData('AAPL');
    expect(global.fetch).toHaveBeenCalledWith('/api/stock?symbol=AAPL&days=30');
  });
});

// ---------------------------------------------------------------------------
// fetchFedStartData
// ---------------------------------------------------------------------------
describe('fetchFedStartData', () => {
  const DEFAULT_FED_START = {
    inflation: 2.0,
    unemployment: 5.0,
    interestRate: 4.0,
    source: 'fallback',
    asOf: 'N/A',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed payload when response is valid', async () => {
    const mockPayload = {
      inflation: 3.1,
      unemployment: 4.2,
      interestRate: 5.25,
      source: 'FRED',
      asOf: '2024-01-01',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as unknown as Response);

    const result = await fetchFedStartData();
    expect(result).toEqual(mockPayload);
  });

  it('returns DEFAULT_FED_START when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    } as unknown as Response);

    const result = await fetchFedStartData();
    expect(result).toEqual(DEFAULT_FED_START);
  });

  it('returns DEFAULT_FED_START when payload is missing numeric fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ inflation: 'bad', unemployment: 5.0, interestRate: 4.0 }),
    } as unknown as Response);

    const result = await fetchFedStartData();
    expect(result).toEqual(DEFAULT_FED_START);
  });

  it('returns DEFAULT_FED_START when payload is null (JSON parse fails)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('not json'); },
    } as unknown as Response);

    const result = await fetchFedStartData();
    expect(result).toEqual(DEFAULT_FED_START);
  });

  it('returns DEFAULT_FED_START when fetch itself throws a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const result = await fetchFedStartData();
    expect(result).toEqual(DEFAULT_FED_START);
  });

  it('returns DEFAULT_FED_START when any single numeric field is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ inflation: 3.0, unemployment: 4.5 }), // interestRate missing
    } as unknown as Response);

    const result = await fetchFedStartData();
    expect(result).toEqual(DEFAULT_FED_START);
  });
});
