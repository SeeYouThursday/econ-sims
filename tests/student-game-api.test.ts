import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchTradeHistory,
  fetchLeaderboard,
  fetchPortfolio,
  fetchTradeQuote,
  submitTrade,
} from '../components/student-game/api';

describe('student-game api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchPortfolio returns parsed portfolio on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        studentId: 'student_1',
        classroomCode: 'ABC123',
        username: 'student_01',
        classroomActive: true,
        classroomEndsAt: '2026-05-01T00:00:00.000Z',
        cash: 9000,
        positions: { AAPL: 10 },
        holdingsValue: 1000,
        totalValue: 10000,
        pnlValue: 0,
        pnlPercent: 0,
      }),
    } as Response);

    const result = await fetchPortfolio('token_1');

    expect(result.studentId).toBe('student_1');
    expect(result.classroomActive).toBe(true);
    expect(result.totalValue).toBe(10000);
  });

  it('fetchPortfolio throws server error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Session expired. Please sign in again.' }),
    } as Response);

    await expect(fetchPortfolio('expired_token')).rejects.toThrow(
      'Session expired. Please sign in again.',
    );
  });

  it('fetchLeaderboard throws on malformed success payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ classroomCode: 'ABC123' }),
    } as Response);

    await expect(fetchLeaderboard('ABC123')).rejects.toThrow(
      'Unable to load classroom leaderboard.',
    );
  });

  it('submitTrade returns trade result on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        latestPrice: 100,
        quoteAsOf: '2026-04-07',
        executedAt: '2026-04-07T12:00:00.000Z',
        storage: 'memory',
        portfolio: {
          studentId: 'student_1',
          classroomCode: 'ABC123',
          username: 'student_01',
          classroomActive: true,
          classroomEndsAt: '2026-05-01T00:00:00.000Z',
          cash: 9000,
          positions: { AAPL: 10 },
          holdingsValue: 1000,
          totalValue: 10000,
          pnlValue: 0,
          pnlPercent: 0,
        },
      }),
    } as Response);

    const result = await submitTrade({
      session: {
        token: 'token_1',
        classroomCode: 'ABC123',
        username: 'student_01',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      symbol: 'AAPL',
      side: 'buy',
      shares: 10,
    });

    expect(result.latestPrice).toBe(100);
    expect(result.quoteAsOf).toBe('2026-04-07');
    expect(result.portfolio.positions.AAPL).toBe(10);
  });

  it('submitTrade throws server error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Insufficient cash to place buy order.' }),
    } as Response);

    await expect(
      submitTrade({
        session: {
          token: 'token_1',
          classroomCode: 'ABC123',
          username: 'student_01',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        symbol: 'AAPL',
        side: 'buy',
        shares: 1000,
      }),
    ).rejects.toThrow('Insufficient cash to place buy order.');
  });

  it('fetchTradeQuote returns latest candle close as quote', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: 'AAPL',
        candles: [
          { date: '2026-04-04', close: 201.14 },
          { date: '2026-04-07', close: 205.32 },
        ],
      }),
    } as Response);

    const result = await fetchTradeQuote('aapl');

    expect(result.symbol).toBe('AAPL');
    expect(result.latestPrice).toBe(205.32);
    expect(result.asOf).toBe('2026-04-07');
  });

  it('fetchTradeQuote throws when no valid candle data is returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: 'AAPL',
        candles: [],
      }),
    } as Response);

    await expect(fetchTradeQuote('AAPL')).rejects.toThrow(
      'Unable to load stock quote.',
    );
  });

  it('fetchTradeHistory returns parsed trade history', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        classroomCode: 'ABC123',
        username: 'student_01',
        asOf: '2026-04-07T12:00:00.000Z',
        trades: [
          {
            id: 'trade_1',
            symbol: 'AAPL',
            side: 'buy',
            shares: 2,
            price: 100,
            quoteAsOf: '2026-04-07',
            executedAt: '2026-04-07T12:00:00.000Z',
          },
        ],
      }),
    } as Response);

    const result = await fetchTradeHistory('token_1');
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.symbol).toBe('AAPL');
  });

  it('fetchTradeHistory throws on malformed response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ trades: [] }),
    } as Response);

    await expect(fetchTradeHistory('token_1')).rejects.toThrow(
      'Unable to load trade history.',
    );
  });
});
