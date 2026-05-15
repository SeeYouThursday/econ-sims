import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('student alias store passcode persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the encrypted database passcode when listing aliases', async () => {
    vi.stubEnv(
      'STOCK_GAME_PASSCODE_ENCRYPTION_KEY',
      'student-alias-store-test-key',
    );

    const { encryptRecoverablePasscode } = await import(
      '../lib/passcodeCipher'
    );

    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ');

      if (query.includes('SELECT')) {
        return [
          {
            id: 'alias_1',
            classroom_code: 'ABC123',
            username: 'student_01',
            student_passcode_encrypted:
              encryptRecoverablePasscode('SAFE1234'),
            is_active: true,
            created_at: '2026-04-16T12:00:00.000Z',
          },
        ];
      }

      return [];
    });

    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { listStudentAliasesByClassroom } = await import(
      '../lib/studentAliasStore'
    );

    const result = await listStudentAliasesByClassroom('abc123');

    expect(result.storage).toBe('neon');
    expect(result.aliases).toHaveLength(1);
    expect(result.aliases[0]?.studentPasscode).toBe('SAFE1234');
    expect(result.aliases[0]?.classroomCode).toBe('ABC123');
  });

  it('returns null when encrypted values are absent', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ');

      if (query.includes('SELECT')) {
        return [
          {
            id: 'alias_2',
            classroom_code: 'ABC123',
            username: 'student_02',
            student_passcode_encrypted: null,
            is_active: true,
            created_at: '2026-04-16T12:00:00.000Z',
          },
        ];
      }

      return [];
    });

    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { listStudentAliasesByClassroom } = await import(
      '../lib/studentAliasStore'
    );

    const result = await listStudentAliasesByClassroom('ABC123');

    expect(result.aliases).toHaveLength(1);
    expect(result.aliases[0]?.studentPasscode).toBeNull();
  });

  it('stores new database passcodes in encrypted form instead of plaintext', async () => {
    vi.stubEnv(
      'STOCK_GAME_PASSCODE_ENCRYPTION_KEY',
      'student-alias-store-test-key',
    );

    const sql = vi.fn(async () => []);

    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { upsertStudentAlias } = await import('../lib/studentAliasStore');

    await upsertStudentAlias({
      classroomCode: 'ABC123',
      username: 'student_03',
      studentPasscode: 'HIDE9999',
      isActive: true,
    });

    const insertCall = sql.mock.calls.find((call) => {
      if (call.length === 0) {
        return false;
      }

      const [strings] = call as unknown as [TemplateStringsArray, ...unknown[]];
      return strings
        .join(' ')
        .includes('INSERT INTO stock_game_student_aliases');
    });

    expect(insertCall).toBeDefined();
    const insertValues = insertCall?.slice(1) ?? [];

    // upsertStudentAlias normalizes username to upper-case, matching the
    // uppercased keys used by the roster Map (see commit cbea62c).
    expect(insertValues).toContain('ABC123');
    expect(insertValues).toContain('STUDENT_03');
    expect(insertValues).toContain(true);
    expect(insertValues).not.toContain('HIDE9999');

    const encryptedValue = insertValues.find(
      (value) =>
        typeof value === 'string' &&
        value !== 'ABC123' &&
        value !== 'STUDENT_03',
    );
    expect(encryptedValue).toBeTypeOf('string');
    expect(encryptedValue).not.toBe('HIDE9999');
  });

  it('rejects new database passcode writes when the encryption key is missing', async () => {
    delete process.env.STOCK_GAME_PASSCODE_ENCRYPTION_KEY;
    process.env.DATABASE_URL = 'postgres://configured-db-url';

    const sql = vi.fn(async () => []);

    vi.doMock('../lib/neon', () => ({
      isNeonConfigured: () => true,
      getNeonSql: () => sql,
    }));

    const { upsertStudentAlias } = await import('../lib/studentAliasStore');

    await expect(
      upsertStudentAlias({
        classroomCode: 'ABC123',
        username: 'student_04',
        studentPasscode: 'FAIL1234',
        isActive: true,
      }),
    ).rejects.toThrow(
      'Missing STOCK_GAME_PASSCODE_ENCRYPTION_KEY for student credential storage.',
    );
  });
});
