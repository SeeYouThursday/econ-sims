import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('stock game state recovery from alias store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    vi.stubEnv('STOCK_GAME_PASSCODE_ENCRYPTION_KEY', 'recover-key');
  });

  it('rebuilds missing student state from alias store and allows student login', async () => {
    const { encryptRecoverablePasscode } =
      await import('../lib/passcodeCipher');
    const encryptedPasscode = encryptRecoverablePasscode('pass1234');

    const sql = vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(' ');

        if (query.includes('CREATE TABLE IF NOT EXISTS stock_game_state')) {
          return [];
        }

        if (
          query.includes('SELECT data') &&
          query.includes('stock_game_state')
        ) {
          return [
            {
              data: JSON.stringify({
                classrooms: {
                  RBDMRE: {
                    code: 'RBDMRE',
                    teacherPasscodeHash: 'fakehash',
                    createdAt: '2026-04-29T19:08:46.755Z',
                  },
                },
                students: {},
                studentsByClassAndName: {},
                sessions: {},
                trades: [],
                marketPricesByClass: {},
              }),
            },
          ];
        }

        if (query.includes('SELECT classroom_code, username')) {
          return [
            {
              classroom_code: 'RBDMRE',
              username: 'steady_turtle17',
              student_passcode_encrypted: encryptedPasscode,
              is_active: true,
              created_at: '2026-04-29T19:08:46.755Z',
            },
          ];
        }

        if (query.includes('INSERT INTO stock_game_state')) {
          return [];
        }

        return [];
      },
    );

    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { loginStudent } = await import('../lib/stockGameStore');
    const session = await loginStudent({
      classroomCode: 'RBDMRE',
      username: 'steady_turtle17',
      studentPasscode: 'pass1234',
    });

    expect(session.classroomCode).toBe('RBDMRE');
    expect(session.username).toBe('steady_turtle17');
    expect(session.token).toBeTypeOf('string');
  });
});
