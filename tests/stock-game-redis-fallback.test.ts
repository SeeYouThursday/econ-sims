import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { createNormalizedNeonMock } from './_helpers/normalized-neon-mock';

const CLASSROOM = process.env.STOCK_GAME_CLASSROOM_CODE ?? 'DEMO101';
const TEACHER_PASSCODE =
  process.env.STOCK_GAME_TEACHER_PASSCODE ?? 'teacher-demo';

describe('stock game Neon failure handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@/lib/neon');
    vi.doUnmock('@/lib/redis');
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('does not report student creation success when persistent storage is unavailable', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    vi.stubEnv('STOCK_GAME_PASSCODE_ENCRYPTION_KEY', 'test-passcode-secret');
    vi.stubEnv('POLYGON_API_KEY', 'test-key');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ c: 100 }] }),
    } as Response);

    vi.doMock('@/lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: vi.fn(() => {
        throw new Error('neon unavailable');
      }),
    }));

    const store = await import('../lib/stockGameStore');
    await store.__resetStockGameState();

    const studentsRoute = await import('../app/api/stock-game/students/route');
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
    expect(createRes.status).toBe(503);
    await expect(createRes.json()).resolves.toEqual({
      error:
        'Persistent stock game storage is unavailable. Please try again shortly.',
    });
  });

  it('uses Neon for durable student creation and login even when Redis is unavailable', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');

    const { sql } = createNormalizedNeonMock();

    vi.doMock('@/lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: vi.fn(() => sql),
    }));

    vi.doMock('@/lib/redis', () => ({
      isRedisConfigured: () => true,
      getRedisClient: vi.fn(async () => {
        throw new Error('redis unavailable');
      }),
    }));

    const store = await import('../lib/stockGameStore');
    await store.__resetStockGameState();

    const created = await store.createStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'neon_first_1',
      studentPasscode: 'pass1234',
    });
    expect(created.storage).toBe('neon');

    delete (globalThis as Record<string, unknown>).__stockGameState;

    const session = await store.loginStudent({
      classroomCode: CLASSROOM,
      username: 'neon_first_1',
      studentPasscode: 'pass1234',
    });

    expect(session.storage).toBe('neon');
    expect(session.username).toBe('neon_first_1');
    expect(session.token).toBeTypeOf('string');
  });

  it('bootstraps existing legacy Redis stock-game state into normalized tables when Neon is empty', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');

    const legacyState = {
      classrooms: {
        [CLASSROOM]: {
          code: CLASSROOM,
          teacherPasscodeHash: createHash('sha256')
            .update(TEACHER_PASSCODE)
            .digest('hex'),
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      students: {
        student_legacy_1: {
          id: 'student_legacy_1',
          classroomCode: CLASSROOM,
          username: 'legacy_01',
          passcodeHash: createHash('sha256').update('pass1234').digest('hex'),
          isActive: true,
          cash: 10000,
          positions: {},
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      studentsByClassAndName: {
        [`${CLASSROOM}::legacy_01`]: 'student_legacy_1',
      },
      sessions: {},
      trades: [],
      marketPricesByClass: {},
    };

    const { sql, store: neonStore } = createNormalizedNeonMock();

    vi.doMock('@/lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: vi.fn(() => sql),
    }));

    vi.doMock('@/lib/redis', () => ({
      isRedisConfigured: () => true,
      getRedisClient: vi.fn(async () => ({
        get: vi.fn(async (key: string) =>
          key === 'econ-sims:stock-game:state'
            ? JSON.stringify(legacyState)
            : null,
        ),
        setEx: vi.fn(),
        del: vi.fn(),
      })),
    }));

    const store = await import('../lib/stockGameStore');
    const leaderboard = await store.getLeaderboard(CLASSROOM);

    // The legacy student appears via the Redis-bootstrapped, normalized data.
    expect(leaderboard.entries[0]?.username).toBe('legacy_01');

    // The classroom and student should now live in the normalized tables.
    expect(neonStore.classrooms.has(CLASSROOM)).toBe(true);
    const studentRow = Array.from(neonStore.studentsById.values()).find(
      (s) => s.username === 'legacy_01',
    );
    expect(studentRow).toBeDefined();
    expect(studentRow?.classroom_code).toBe(CLASSROOM);
  });
});
