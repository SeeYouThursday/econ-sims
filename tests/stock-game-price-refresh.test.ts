import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNormalizedNeonMock } from './_helpers/normalized-neon-mock';

const CLASSROOM = 'PRICE01';

function classroomRow(code: string) {
  return {
    code,
    teacher_passcode_hash: 'h',
    owner_teacher_id: null,
    title: null,
    starting_cash: 1_000_000,
    duration_days: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function marketPriceRow(code: string, symbol: string, price: number) {
  return {
    classroom_code: code,
    symbol,
    price,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function seedClassroom(symbols: Array<[string, number]>) {
  return {
    classrooms: new Map([[CLASSROOM, classroomRow(CLASSROOM)]]),
    marketPrices: new Map([
      [
        CLASSROOM,
        new Map(symbols.map(([s, p]) => [s, marketPriceRow(CLASSROOM, s, p)])),
      ],
    ]),
  };
}

function mockBackends(sql: ReturnType<typeof createNormalizedNeonMock>['sql']) {
  vi.doMock('../lib/neon', () => ({
    isNeonConfigured: () => true,
    getNeonSql: () => sql,
  }));
  vi.doMock('../lib/redis', () => ({
    isRedisConfigured: () => false,
    getRedisClient: vi.fn(async () => null),
  }));
}

/**
 * Stubs `globalThis.fetch` to look like Polygon and counts calls per symbol.
 * Each call returns `c = (per-symbol call index)`, so consecutive refreshes of
 * the same symbol produce different close prices (1, 2, …).
 */
function polygonFetchStub() {
  const callsBySymbol = new Map<string, number>();
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!url.includes('api.polygon.io')) {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }
      const match = url.match(/\/ticker\/([^/]+)\/range/);
      const symbol = match?.[1]?.toUpperCase() ?? '?';
      const next = (callsBySymbol.get(symbol) ?? 0) + 1;
      callsBySymbol.set(symbol, next);
      return {
        ok: true,
        json: async () => ({
          results: [{ c: next, t: Date.now() }],
        }),
      } as Response;
    });
  return { spy, callsBySymbol };
}

describe('stock game market_prices lazy refresh', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    vi.stubEnv('POLYGON_API_KEY', 'test-key');
    // Tests run with the throttle disabled so multi-symbol refreshes finish
    // immediately. The throttle is a rate-limit safety net, not a behavior
    // under test here.
    vi.stubEnv('STOCK_PRICE_REFRESH_THROTTLE_MS', '0');
  });

  it('refreshes stored market prices on a stale read and skips the next call inside the TTL window', async () => {
    const { sql, store } = createNormalizedNeonMock(seedClassroom([['AAPL', 50_000]]));
    mockBackends(sql);
    const { spy } = polygonFetchStub();

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    const first = await stockStore.getLeaderboard(CLASSROOM);
    expect(first).toBeDefined();
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);
    expect(spy).toHaveBeenCalledTimes(1);

    const refreshedRow = store.marketPrices.get(CLASSROOM)?.get('AAPL');
    expect(Number(refreshedRow?.price)).toBe(100);

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not call Polygon when no symbols are stored for the classroom', async () => {
    const { sql } = createNormalizedNeonMock({
      classrooms: new Map([[CLASSROOM, classroomRow(CLASSROOM)]]),
    });
    mockBackends(sql);
    const { spy } = polygonFetchStub();

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);
    expect(spy).not.toHaveBeenCalled();
  });

  it('refreshes every stored symbol on a stale read', async () => {
    const { sql, store } = createNormalizedNeonMock(
      seedClassroom([
        ['AAPL', 50_000],
        ['MSFT', 60_000],
        ['NVDA', 70_000],
      ]),
    );
    mockBackends(sql);
    const { spy, callsBySymbol } = polygonFetchStub();

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(spy).toHaveBeenCalledTimes(3);
    expect(callsBySymbol.get('AAPL')).toBe(1);
    expect(callsBySymbol.get('MSFT')).toBe(1);
    expect(callsBySymbol.get('NVDA')).toBe(1);

    const prices = store.marketPrices.get(CLASSROOM)!;
    expect(Number(prices.get('AAPL')?.price)).toBe(100);
    expect(Number(prices.get('MSFT')?.price)).toBe(100);
    expect(Number(prices.get('NVDA')?.price)).toBe(100);
  });

  it('leaves stored prices untouched when Polygon returns an error', async () => {
    const { sql, store } = createNormalizedNeonMock(seedClassroom([['AAPL', 50_000]]));
    mockBackends(sql);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Refresh attempted but Polygon failed; stored price stays as seeded.
    expect(Number(store.marketPrices.get(CLASSROOM)?.get('AAPL')?.price)).toBe(50_000);
  });

  it('leaves stored prices untouched when Polygon throws a network error', async () => {
    const { sql, store } = createNormalizedNeonMock(seedClassroom([['AAPL', 50_000]]));
    mockBackends(sql);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(Number(store.marketPrices.get(CLASSROOM)?.get('AAPL')?.price)).toBe(50_000);
  });

  it('leaves stored prices untouched when Polygon returns no recent data', async () => {
    const { sql, store } = createNormalizedNeonMock(seedClassroom([['AAPL', 50_000]]));
    mockBackends(sql);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(Number(store.marketPrices.get(CLASSROOM)?.get('AAPL')?.price)).toBe(50_000);
  });

  it('dedupes parallel refreshes for the same classroom into a single Polygon call', async () => {
    const { sql } = createNormalizedNeonMock(seedClassroom([['AAPL', 50_000]]));
    mockBackends(sql);
    const { spy } = polygonFetchStub();

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await Promise.all([
      stockStore.getLeaderboard(CLASSROOM),
      stockStore.getLeaderboard(CLASSROOM),
      stockStore.getLeaderboard(CLASSROOM),
    ]);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-attempts the refresh after the TTL interval elapses', async () => {
    // 1 ms interval + a small wait between reads guarantees TTL expiry. A 0
    // interval is intentionally a "disable refresh" sentinel and won't work
    // here. Use getPortfolio (no leaderboard memory cache) so the second
    // call actually reaches the refresh path.
    vi.stubEnv('STOCK_PRICE_REFRESH_INTERVAL_MS', '1');

    const { sql, store } = createNormalizedNeonMock(
      seedClassroom([['AAPL', 50_000]]),
    );
    mockBackends(sql);
    const { spy } = polygonFetchStub();

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    // Reset wipes sessions and students. Re-seed market_prices, students,
    // and a session AFTER reset so getPortfolio has something to read. Note
    // that the mock's `delete from market_prices` (no WHERE) is shadowed by
    // its broader `from market_prices` SELECT handler, so the seeded prices
    // survived reset — but students and sessions did not.
    store.studentsById.set('student_1', {
      id: 'student_1',
      classroom_code: CLASSROOM,
      username: 'tester',
      passcode_hash: 'h',
      is_active: true,
      cash: 1_000_000,
      positions: { AAPL: 1 },
      created_at: new Date().toISOString(),
    });
    store.sessions.set('token-1', {
      token: 'token-1',
      student_id: 'student_1',
      classroom_code: CLASSROOM,
      expires_at: Date.now() + 60_000,
      created_at: new Date().toISOString(),
    });

    await stockStore.getPortfolio('token-1');
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);
    expect(spy).toHaveBeenCalledTimes(1);

    // 30ms covers Windows' coarse Date.now() resolution comfortably.
    await new Promise((resolve) => setTimeout(resolve, 30));

    await stockStore.getPortfolio('token-1');
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('respects STOCK_PRICE_REFRESH_INTERVAL_MS overrides', async () => {
    // 1-hour interval: the second read inside the same second must skip.
    vi.stubEnv('STOCK_PRICE_REFRESH_INTERVAL_MS', String(60 * 60 * 1000));

    const { sql } = createNormalizedNeonMock(seedClassroom([['AAPL', 50_000]]));
    mockBackends(sql);
    const { spy } = polygonFetchStub();

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);
    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throttles consecutive Polygon calls within a refresh', async () => {
    vi.stubEnv('STOCK_PRICE_REFRESH_THROTTLE_MS', '50');

    const { sql } = createNormalizedNeonMock(
      seedClassroom([
        ['AAPL', 50_000],
        ['MSFT', 60_000],
        ['NVDA', 70_000],
      ]),
    );
    mockBackends(sql);

    const callTimes: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callTimes.push(Date.now());
      return {
        ok: true,
        json: async () => ({ results: [{ c: 1, t: Date.now() }] }),
      } as Response;
    });

    const stockStore = await import('../lib/stockGameStore');
    await stockStore.__resetStockGameState();

    await stockStore.getLeaderboard(CLASSROOM);
    await stockStore.__waitForPendingPriceRefresh(CLASSROOM);

    expect(callTimes).toHaveLength(3);
    // Each call after the first should be at least ~throttle ms after the
    // previous. Allow a small tolerance for timer jitter.
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(40);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(40);
  });
});
