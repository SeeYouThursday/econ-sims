import { beforeEach, describe, expect, it } from 'vitest';
import { __resetStockGameState } from '../lib/stockGameStore';

const CLASSROOM = process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101';
const TEACHER_PASSCODE =
  process.env.STOCK_GAME_TEACHER_PASSCODE ?? 'teacher-demo';

describe('/api/stock-game routes', () => {
  beforeEach(() => {
    return __resetStockGameState();
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
    expect(leaderboard.entries[0]?.totalValue).toBe(10300);
    expect(leaderboard.entries[1]?.totalValue).toBe(10200);
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
});
