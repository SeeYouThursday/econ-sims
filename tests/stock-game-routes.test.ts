import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetStockGameState } from '../lib/stockGameStore';

const CLASSROOM = process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101';
const TEACHER_PASSCODE =
  process.env.STOCK_GAME_TEACHER_PASSCODE ?? 'teacher-demo';

function expireClassroom(classroomCode: string) {
  const state = (
    globalThis as typeof globalThis & {
      __stockGameState?: {
        classrooms?: Record<
          string,
          { createdAt: string; durationDays?: number }
        >;
      };
    }
  ).__stockGameState;

  const classroom = state?.classrooms?.[classroomCode];
  if (!classroom) {
    throw new Error(
      `Expected classroom ${classroomCode} to exist in test state.`,
    );
  }

  classroom.durationDays = 1;
  classroom.createdAt = '2000-01-01T00:00:00.000Z';
}

describe('/api/stock-game routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('POLYGON_API_KEY', 'test-key');
    delete (globalThis as Record<string, unknown>)
      .__econSimsRateLimitMemoryCounters;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!url.includes('api.polygon.io')) {
        throw new Error(`Unexpected fetch URL in stock-game tests: ${url}`);
      }

      const priceBySymbol: Record<string, number> = {
        AAPL: 100,
        MSFT: 100,
      };

      const symbolMatch = url.match(/\/ticker\/([^/]+)\/range/);
      const symbol = symbolMatch?.[1]?.toUpperCase() ?? 'AAPL';
      const close = priceBySymbol[symbol] ?? 100;

      return {
        ok: true,
        json: async () => ({
          results: [{ c: close }],
        }),
      } as Response;
    });

    return __resetStockGameState();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('creates student, logs in, trades, and returns portfolio', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const portfolioRoute =
      await import('../app/api/stock-game/portfolio/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_a1',
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
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(authRes.status).toBe(200);
    const authPayload = (await authRes.json()) as { token: string };
    expect(authPayload.token).toBeTypeOf('string');

    const tradeRes = await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 10,
          price: 100,
        }),
      }),
    );

    expect(tradeRes.status).toBe(201);
    const tradePayload = (await tradeRes.json()) as {
      portfolio: { cash: number; positions: Record<string, number> };
    };
    expect(tradePayload.portfolio.cash).toBe(9000);
    expect(tradePayload.portfolio.positions.AAPL).toBe(10);

    const portfolioRes = await portfolioRoute.GET(
      new Request(
        `http://localhost/api/stock-game/portfolio?token=${authPayload.token}`,
      ),
    );

    expect(portfolioRes.status).toBe(200);
    const portfolioPayload = (await portfolioRes.json()) as {
      totalValue: number;
      holdingsValue: number;
    };

    expect(portfolioPayload.holdingsValue).toBe(1000);
    expect(portfolioPayload.totalValue).toBe(10000);
  });

  it('recovers student login when the alias lookup index is missing', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const memoryState = (
      globalThis as unknown as {
        __stockGameState?: { studentsByClassAndName?: Record<string, string> };
      }
    ).__stockGameState;
    if (memoryState) {
      delete memoryState.studentsByClassAndName;
    }

    const authRes = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(authRes.status).toBe(200);
    const authPayload = (await authRes.json()) as { token: string };
    expect(authPayload.token).toBeTypeOf('string');
  });

  it('returns leaderboard ranked by total value', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const leaderboardRoute =
      await import('../app/api/stock-game/leaderboard/route');

    await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_b1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    const authA = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    const authAPayload = (await authA.json()) as { token: string };

    const authB = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_b1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    const authBPayload = (await authB.json()) as { token: string };

    await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authAPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 10,
          price: 90,
        }),
      }),
    );

    await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authBPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 10,
          price: 100,
        }),
      }),
    );

    await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authAPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 1,
          price: 120,
        }),
      }),
    );

    const leaderboardRes = await leaderboardRoute.GET(
      new Request(
        `http://localhost/api/stock-game/leaderboard?classroomCode=${CLASSROOM}`,
      ),
    );

    expect(leaderboardRes.status).toBe(200);
    const leaderboard = (await leaderboardRes.json()) as {
      entries: Array<{ username: string; rank: number; totalValue: number }>;
      source: string;
    };

    expect(leaderboard.entries).toHaveLength(2);
    expect(leaderboard.entries[0]?.username).toBe('student_a1');
    expect(leaderboard.entries[0]?.rank).toBe(1);
    expect(leaderboard.entries[0]?.totalValue).toBe(10000);
    expect(leaderboard.entries[1]?.totalValue).toBe(10000);
    expect(leaderboard.source).toBe('computed');

    const cachedRes = await leaderboardRoute.GET(
      new Request(
        `http://localhost/api/stock-game/leaderboard?classroomCode=${CLASSROOM}`,
      ),
    );
    const cachedPayload = (await cachedRes.json()) as { source: string };
    expect(cachedPayload.source).toBe('cache');
  });

  it('rejects student creation with wrong teacher passcode', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: 'wrong-code',
          username: 'student_a1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(createRes.status).toBe(401);
    const payload = (await createRes.json()) as { error: string };
    expect(payload.error).toContain('Invalid teacher passcode');
  });

  it('deletes student account when teacher requests deletion', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_c1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(createRes.status).toBe(201);

    const deleteRes = await studentsRoute.DELETE(
      new Request('http://localhost/api/stock-game/students', {
        method: 'DELETE',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_c1',
        }),
      }),
    );

    expect(deleteRes.status).toBe(200);

    const authRes = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_c1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(authRes.status).toBe(404);
  });

  it('resets, deactivates, and reactivates student accounts via teacher actions', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const portfolioRoute =
      await import('../app/api/stock-game/portfolio/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_e1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(createRes.status).toBe(201);

    const loginBefore = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_e1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(loginBefore.status).toBe(200);
    const loginBeforePayload = (await loginBefore.json()) as { token: string };

    await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: loginBeforePayload.token,
          symbol: 'MSFT',
          side: 'buy',
          shares: 5,
          price: 100,
        }),
      }),
    );

    const resetRes = await studentsRoute.PATCH(
      new Request('http://localhost/api/stock-game/students', {
        method: 'PATCH',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_e1',
          action: 'reset',
        }),
      }),
    );
    expect(resetRes.status).toBe(200);

    const loginAfterReset = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_e1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(loginAfterReset.status).toBe(200);
    const loginAfterResetPayload = (await loginAfterReset.json()) as {
      token: string;
    };

    const portfolioAfterResetRes = await portfolioRoute.GET(
      new Request(
        `http://localhost/api/stock-game/portfolio?token=${loginAfterResetPayload.token}`,
      ),
    );
    expect(portfolioAfterResetRes.status).toBe(200);
    const portfolioAfterReset = (await portfolioAfterResetRes.json()) as {
      cash: number;
      positions: Record<string, number>;
    };
    expect(portfolioAfterReset.cash).toBe(10000);
    expect(Object.keys(portfolioAfterReset.positions)).toHaveLength(0);

    const deactivateRes = await studentsRoute.PATCH(
      new Request('http://localhost/api/stock-game/students', {
        method: 'PATCH',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_e1',
          action: 'deactivate',
        }),
      }),
    );
    expect(deactivateRes.status).toBe(200);

    const loginWhileDeactivated = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_e1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(loginWhileDeactivated.status).toBe(403);

    const reactivateRes = await studentsRoute.PATCH(
      new Request('http://localhost/api/stock-game/students', {
        method: 'PATCH',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_e1',
          action: 'activate',
        }),
      }),
    );
    expect(reactivateRes.status).toBe(200);

    const loginAfterReactivation = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_e1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(loginAfterReactivation.status).toBe(200);
  });

  it('rejects non-alias username to minimize personal data', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'johnsmith',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(createRes.status).toBe(400);
    const payload = (await createRes.json()) as { error: string };
    expect(payload.error).toContain('includes at least one number');
  });

  it('returns teacher audit summary without student-level PII', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const auditRoute = await import('../app/api/stock-game/audit/route');

    await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_d1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    const authRes = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_d1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    const authPayload = (await authRes.json()) as { token: string };

    await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 2,
          price: 100,
        }),
      }),
    );

    const auditRes = await auditRoute.POST(
      new Request('http://localhost/api/stock-game/audit', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
        }),
      }),
    );

    expect(auditRes.status).toBe(200);
    const auditPayload = (await auditRes.json()) as {
      studentCount: number;
      tradeCount: number;
      buyCount: number;
      sellCount: number;
      piiIncluded: boolean;
      topSymbols: Array<{ symbol: string; trades: number }>;
      usernames?: string[];
    };

    expect(auditPayload.studentCount).toBe(1);
    expect(auditPayload.tradeCount).toBe(1);
    expect(auditPayload.buyCount).toBe(1);
    expect(auditPayload.sellCount).toBe(0);
    expect(auditPayload.piiIncluded).toBe(false);
    expect(auditPayload.usernames).toBeUndefined();
    expect(auditPayload.topSymbols[0]?.symbol).toBe('AAPL');
  });

  it('uses server quote price and ignores client-supplied trade price', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const portfolioRoute =
      await import('../app/api/stock-game/portfolio/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_z1',
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
          username: 'student_z1',
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
          price: 1,
        }),
      }),
    );
    expect(tradeRes.status).toBe(201);

    const tradePayload = (await tradeRes.json()) as {
      latestPrice: number;
      quoteAsOf: string;
      executedAt: string;
      portfolio: { cash: number };
    };
    expect(tradePayload.latestPrice).toBe(100);
    expect(tradePayload.quoteAsOf).toBeTypeOf('string');
    expect(tradePayload.executedAt).toBeTypeOf('string');
    expect(tradePayload.portfolio.cash).toBe(9900);

    const portfolioRes = await portfolioRoute.GET(
      new Request(
        `http://localhost/api/stock-game/portfolio?token=${authPayload.token}`,
      ),
    );
    expect(portfolioRes.status).toBe(200);
    const portfolioPayload = (await portfolioRes.json()) as {
      holdingsValue: number;
      totalValue: number;
    };

    expect(portfolioPayload.holdingsValue).toBe(100);
    expect(portfolioPayload.totalValue).toBe(10000);
  });

  it('returns recent trade history for a signed-in student token', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_h1',
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
          username: 'student_h1',
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
          shares: 2,
        }),
      }),
    );
    expect(tradeRes.status).toBe(201);

    const historyRes = await tradesRoute.GET(
      new Request(
        `http://localhost/api/stock-game/trades?token=${authPayload.token}&limit=10`,
      ),
    );
    expect(historyRes.status).toBe(200);

    const historyPayload = (await historyRes.json()) as {
      classroomCode: string;
      username: string;
      trades: Array<{
        symbol: string;
        side: string;
        shares: number;
        price: number;
        quoteAsOf: string;
        executedAt: string;
      }>;
    };

    expect(historyPayload.classroomCode).toBe(CLASSROOM);
    expect(historyPayload.username).toBe('student_h1');
    expect(historyPayload.trades).toHaveLength(1);
    expect(historyPayload.trades[0]?.symbol).toBe('AAPL');
    expect(historyPayload.trades[0]?.side).toBe('buy');
    expect(historyPayload.trades[0]?.shares).toBe(2);
    expect(historyPayload.trades[0]?.price).toBe(100);
    expect(historyPayload.trades[0]?.quoteAsOf).toBeTypeOf('string');
    expect(historyPayload.trades[0]?.executedAt).toBeTypeOf('string');
  });

  it('rejects student sign-in when the classroom duration has ended', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_expired1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(createRes.status).toBe(201);

    expireClassroom(CLASSROOM);

    const authRes = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_expired1',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(authRes.status).toBe(403);
    const authPayload = (await authRes.json()) as { error: string };
    expect(authPayload.error).toContain('classroom game has ended');
  });

  it('rejects new trades when the classroom duration has ended', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_expired2',
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
          username: 'student_expired2',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(authRes.status).toBe(200);
    const authPayload = (await authRes.json()) as { token: string };

    expireClassroom(CLASSROOM);

    const tradeRes = await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: authPayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 1,
        }),
      }),
    );

    expect(tradeRes.status).toBe(403);
    const tradePayload = (await tradeRes.json()) as { error: string };
    expect(tradePayload.error).toContain('classroom game has ended');
  });

  it('rejects invalid trade tokens before requesting market quotes', async () => {
    const tradesRoute = await import('../app/api/stock-game/trades/route');

    for (let index = 0; index < 120; index += 1) {
      const response = await tradesRoute.POST(
        new Request('http://localhost/api/stock-game/trades', {
          method: 'POST',
          headers: { 'x-forwarded-for': '203.0.113.10' },
          body: JSON.stringify({
            token: `invalid-token-${index}`,
            symbol: 'AAPL',
            side: 'buy',
            shares: 1,
          }),
        }),
      );

      expect(response.status).toBe(401);
    }

    const blocked = await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.10' },
        body: JSON.stringify({
          token: 'invalid-token-120',
          symbol: 'AAPL',
          side: 'buy',
          shares: 1,
        }),
      }),
    );

    expect(blocked.status).toBe(429);
    expect(globalThis.fetch).toHaveBeenCalledTimes(0);
  });

  it('rate limits student sign-in attempts across varied usernames', async () => {
    const authRoute = await import('../app/api/stock-game/auth/route');

    for (let index = 0; index < 120; index += 1) {
      const response = await authRoute.POST(
        new Request('http://localhost/api/stock-game/auth', {
          method: 'POST',
          headers: { 'x-forwarded-for': '203.0.113.11' },
          body: JSON.stringify({
            classroomCode: CLASSROOM,
            username: `student_missing_${index}`,
            studentPasscode: 'pass1234',
          }),
        }),
      );

      expect(response.status).toBe(404);
    }

    const blocked = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.11' },
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_missing_120',
          studentPasscode: 'pass1234',
        }),
      }),
    );

    expect(blocked.status).toBe(429);
  });

  it('restarts a classroom game with the same student credentials', async () => {
    const studentsRoute = await import('../app/api/stock-game/students/route');
    const authRoute = await import('../app/api/stock-game/auth/route');
    const tradesRoute = await import('../app/api/stock-game/trades/route');
    const portfolioRoute =
      await import('../app/api/stock-game/portfolio/route');

    const createRes = await studentsRoute.POST(
      new Request('http://localhost/api/stock-game/students', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          username: 'student_restart1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(createRes.status).toBe(201);

    const loginBeforeRestart = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_restart1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(loginBeforeRestart.status).toBe(200);
    const loginBeforePayload = (await loginBeforeRestart.json()) as {
      token: string;
    };

    const firstTrade = await tradesRoute.POST(
      new Request('http://localhost/api/stock-game/trades', {
        method: 'POST',
        body: JSON.stringify({
          token: loginBeforePayload.token,
          symbol: 'AAPL',
          side: 'buy',
          shares: 2,
        }),
      }),
    );
    expect(firstTrade.status).toBe(201);

    expireClassroom(CLASSROOM);

    const blockedLogin = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_restart1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(blockedLogin.status).toBe(403);

    const restartRes = await studentsRoute.PATCH(
      new Request('http://localhost/api/stock-game/students', {
        method: 'PATCH',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          teacherPasscode: TEACHER_PASSCODE,
          action: 'restart-game',
        }),
      }),
    );
    expect(restartRes.status).toBe(200);
    const restartPayload = (await restartRes.json()) as {
      action: string;
      studentCount: number;
    };
    expect(restartPayload.action).toBe('restart-game');
    expect(restartPayload.studentCount).toBeGreaterThanOrEqual(1);

    const loginAfterRestart = await authRoute.POST(
      new Request('http://localhost/api/stock-game/auth', {
        method: 'POST',
        body: JSON.stringify({
          classroomCode: CLASSROOM,
          username: 'student_restart1',
          studentPasscode: 'pass1234',
        }),
      }),
    );
    expect(loginAfterRestart.status).toBe(200);
    const loginAfterPayload = (await loginAfterRestart.json()) as {
      token: string;
    };

    const portfolioRes = await portfolioRoute.GET(
      new Request(
        `http://localhost/api/stock-game/portfolio?token=${loginAfterPayload.token}`,
      ),
    );
    expect(portfolioRes.status).toBe(200);
    const portfolio = (await portfolioRes.json()) as {
      cash: number;
      positions: Record<string, number>;
      classroomActive: boolean;
    };
    expect(portfolio.cash).toBe(10000);
    expect(Object.keys(portfolio.positions)).toHaveLength(0);
    expect(portfolio.classroomActive).toBe(true);
  });
});
