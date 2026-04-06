import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLeaderboard,
  fetchPortfolio,
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
        cash: 9000,
        positions: { AAPL: 10 },
        holdingsValue: 1000,
        totalValue: 10000,
      }),
    } as Response);

    const result = await fetchPortfolio('token_1');

    expect(result.studentId).toBe('student_1');
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
        storage: 'memory',
        portfolio: {
          studentId: 'student_1',
          classroomCode: 'ABC123',
          username: 'student_01',
          cash: 9000,
          positions: { AAPL: 10 },
          holdingsValue: 1000,
          totalValue: 10000,
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
      price: 100,
    });

    expect(result.latestPrice).toBe(100);
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
        price: 100,
      }),
    ).rejects.toThrow('Insufficient cash to place buy order.');
  });
});
