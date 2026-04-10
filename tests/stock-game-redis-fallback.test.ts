import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLASSROOM = process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101';
const TEACHER_PASSCODE =
  process.env.STOCK_GAME_TEACHER_PASSCODE ?? 'teacher-demo';

describe('stock game Redis failure fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('falls back to in-memory state when Redis connect fails', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    vi.stubEnv('POLYGON_API_KEY', 'test-key');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ c: 100 }] }),
    } as Response);

    vi.doMock('@/lib/redis', () => ({
      isRedisConfigured: () => true,
      getRedisClient: vi.fn(async () => {
        throw new Error('redis unavailable');
      }),
    }));

    const store = await import('../lib/stockGameStore');
    await store.__resetStockGameState();

    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const leaderboardRoute =
      await import('../app/api/stock-game/leaderboard/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'fallback_01',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(createRes.status).toBe(201);

    const authRes = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'fallback_01',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(authRes.status).toBe(200);
    const authPayload = (await authRes.json()) as { token: string };

    const tradeRes = await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 1,
          price: 100,
        }),
      }),
    );
    expect(tradeRes.status).toBe(201);

    const leaderboardRes = await leaderboardRoute.GET(
      new Request(
        `http://localhost/api/stock-game/leaderboard?classroomCode=${CLASSROOM}`,
      ),
    );
    expect(leaderboardRes.status).toBe(200);
    const leaderboardPayload = (await leaderboardRes.json()) as {
      entries: Array<{ username: string }>;
    };
    expect(leaderboardPayload.entries[0]?.username).toBe('fallback_01');
  });
});
