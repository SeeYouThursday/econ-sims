import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchFedStartData } from '../actions';

describe('fetchFedStartData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns API payload when shape is valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        inflation: 2.8,
        unemployment: 3.9,
        interestRate: 5.25,
        source: 'FRED',
        asOf: '2026-03-01',
      }),
    } as Response);

    const result = await fetchFedStartData();

    expect(result).toEqual({
      inflation: 2.8,
      unemployment: 3.9,
      interestRate: 5.25,
      source: 'FRED',
      asOf: '2026-03-01',
    });
  });

  it('falls back to defaults when response shape is invalid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        inflation: 2.8,
        unemployment: 3.9,
        source: 'FRED',
        asOf: '2026-03-01',
      }),
    } as Response);

    const result = await fetchFedStartData();

    expect(result).toEqual({
      inflation: 2.0,
      unemployment: 5.0,
      interestRate: 4.0,
      source: 'fallback',
      asOf: 'N/A',
    });
  });

  it('falls back to defaults when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    const result = await fetchFedStartData();

    expect(result).toEqual({
      inflation: 2.0,
      unemployment: 5.0,
      interestRate: 4.0,
      source: 'fallback',
      asOf: 'N/A',
    });
  });
});
