import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNormalizedNeonMock } from './_helpers/normalized-neon-mock';

const CLASSROOM = 'TRD101';
const TEACHER_PASSCODE = 'teacher-trd';
const STUDENT_PASSCODE = 'pass1234';
const STARTING_CASH = 10000;

function seededClassroomMock() {
  return createNormalizedNeonMock({
    classrooms: new Map([
      [
        CLASSROOM,
        {
          code: CLASSROOM,
          teacher_passcode_hash: createHash('sha256')
            .update(TEACHER_PASSCODE)
            .digest('hex'),
          owner_teacher_id: null,
          title: null,
          starting_cash: null,
          duration_days: null,
          created_at: '2026-05-01T00:00:00.000Z',
          updated_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    ]),
  });
}

describe('placeTrade against normalized mock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    vi.stubEnv('STOCK_GAME_PASSCODE_ENCRYPTION_KEY', 'trade-test-key');
  });

  it('buys, then sells, debiting and crediting cash with no precision drift', async () => {
    const { sql, store: neonStore } = seededClassroomMock();
    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { createStudent, loginStudent, placeTrade } = await import(
      '../lib/stockGameStore'
    );

    const { studentId } = await createStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'trader_01',
      studentPasscode: STUDENT_PASSCODE,
    });

    const { token } = await loginStudent({
      classroomCode: CLASSROOM,
      username: 'trader_01',
      studentPasscode: STUDENT_PASSCODE,
    });

    const buyResult = await placeTrade({
      token,
      symbol: 'AAPL',
      side: 'buy',
      shares: 10,
      price: 100,
      quoteAsOf: '2026-05-01',
    });

    expect(buyResult.storage).toBe('neon');
    expect(buyResult.portfolio.cash).toBe(STARTING_CASH - 1000);
    expect(buyResult.portfolio.positions.AAPL).toBe(10);

    const studentAfterBuy = neonStore.studentsById.get(studentId);
    expect(studentAfterBuy?.cash).toBe(STARTING_CASH - 1000);
    expect(
      (studentAfterBuy?.positions as Record<string, number>)?.AAPL,
    ).toBe(10);

    const sellResult = await placeTrade({
      token,
      symbol: 'AAPL',
      side: 'sell',
      shares: 4,
      price: 110,
      quoteAsOf: '2026-05-02',
    });

    expect(sellResult.portfolio.cash).toBe(STARTING_CASH - 1000 + 440);
    expect(sellResult.portfolio.positions.AAPL).toBe(6);

    expect(neonStore.trades).toHaveLength(2);
    expect(neonStore.trades.map((t) => t.side)).toEqual(['buy', 'sell']);

    const aaplPrice = neonStore.marketPrices.get(CLASSROOM)?.get('AAPL');
    expect(Number(aaplPrice?.price)).toBe(110);
  });

  it('rejects a buy that exceeds cash without mutating cash or positions', async () => {
    const { sql, store: neonStore } = seededClassroomMock();
    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { createStudent, loginStudent, placeTrade } = await import(
      '../lib/stockGameStore'
    );

    const { studentId } = await createStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'broke_01',
      studentPasscode: STUDENT_PASSCODE,
    });
    const { token } = await loginStudent({
      classroomCode: CLASSROOM,
      username: 'broke_01',
      studentPasscode: STUDENT_PASSCODE,
    });

    await expect(
      placeTrade({
        token,
        symbol: 'AAPL',
        side: 'buy',
        shares: 999,
        price: 100,
        quoteAsOf: '2026-05-01',
      }),
    ).rejects.toThrow('Insufficient cash');

    const student = neonStore.studentsById.get(studentId);
    expect(student?.cash).toBe(STARTING_CASH);
    expect(student?.positions).toEqual({});
    expect(neonStore.trades).toHaveLength(0);
  });

  it('rejects a sell when shares are not held', async () => {
    const { sql } = seededClassroomMock();
    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { createStudent, loginStudent, placeTrade } = await import(
      '../lib/stockGameStore'
    );

    await createStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'long_01',
      studentPasscode: STUDENT_PASSCODE,
    });
    const { token } = await loginStudent({
      classroomCode: CLASSROOM,
      username: 'long_01',
      studentPasscode: STUDENT_PASSCODE,
    });

    await expect(
      placeTrade({
        token,
        symbol: 'AAPL',
        side: 'sell',
        shares: 1,
        price: 100,
        quoteAsOf: '2026-05-01',
      }),
    ).rejects.toThrow('Insufficient shares');
  });
});

describe('manageStudent against normalized mock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    vi.stubEnv('STOCK_GAME_PASSCODE_ENCRYPTION_KEY', 'manage-test-key');
  });

  it('deactivates and reactivates a student', async () => {
    const { sql, store: neonStore } = seededClassroomMock();
    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { createStudent, manageStudent } = await import(
      '../lib/stockGameStore'
    );

    const { studentId } = await createStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'managed_01',
      studentPasscode: STUDENT_PASSCODE,
    });

    const deactivated = await manageStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'managed_01',
      action: 'deactivate',
    });
    expect(deactivated.isActive).toBe(false);
    expect(neonStore.studentsById.get(studentId)?.is_active).toBe(false);

    const activated = await manageStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'managed_01',
      action: 'activate',
    });
    expect(activated.isActive).toBe(true);
    expect(neonStore.studentsById.get(studentId)?.is_active).toBe(true);
  });

  it('resets a student back to starting cash and empty positions', async () => {
    const { sql, store: neonStore } = seededClassroomMock();
    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { createStudent, loginStudent, placeTrade, manageStudent } =
      await import('../lib/stockGameStore');

    const { studentId } = await createStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'reset_01',
      studentPasscode: STUDENT_PASSCODE,
    });
    const { token } = await loginStudent({
      classroomCode: CLASSROOM,
      username: 'reset_01',
      studentPasscode: STUDENT_PASSCODE,
    });
    await placeTrade({
      token,
      symbol: 'AAPL',
      side: 'buy',
      shares: 5,
      price: 100,
      quoteAsOf: '2026-05-01',
    });

    expect(neonStore.studentsById.get(studentId)?.cash).toBe(
      STARTING_CASH - 500,
    );

    await manageStudent({
      classroomCode: CLASSROOM,
      teacherPasscode: TEACHER_PASSCODE,
      username: 'reset_01',
      action: 'reset',
    });

    const studentAfter = neonStore.studentsById.get(studentId);
    expect(Number(studentAfter?.cash)).toBe(STARTING_CASH);
    expect(studentAfter?.positions).toEqual({});
    expect(neonStore.trades.filter((t) => t.student_id === studentId)).toEqual(
      [],
    );
  });
});
