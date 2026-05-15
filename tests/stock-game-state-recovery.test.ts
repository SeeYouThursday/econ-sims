import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNormalizedNeonMock } from './_helpers/normalized-neon-mock';

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

    // Pre-seed the normalized mock with a classroom but no student. The alias
    // table contains the recoverable credentials for steady_turtle17.
    const { sql, store: neonStore } = createNormalizedNeonMock({
      classrooms: new Map([
        [
          'RBDMRE',
          {
            code: 'RBDMRE',
            teacher_passcode_hash: 'fakehash',
            owner_teacher_id: null,
            title: null,
            starting_cash: null,
            duration_days: null,
            created_at: '2026-04-29T19:08:46.755Z',
            updated_at: '2026-04-29T19:08:46.755Z',
          },
        ],
      ]),
      aliases: [
        {
          classroom_code: 'RBDMRE',
          username: 'steady_turtle17',
          student_passcode_encrypted: encryptedPasscode,
          is_active: true,
          created_at: '2026-04-29T19:08:46.755Z',
        },
      ],
    });

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

    // The recovered student should now exist in the normalized students table.
    const recovered = Array.from(neonStore.studentsById.values()).find(
      (s) => s.username === 'steady_turtle17',
    );
    expect(recovered).toBeDefined();
    expect(recovered?.classroom_code).toBe('RBDMRE');
  });
});
