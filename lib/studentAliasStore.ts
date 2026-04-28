import { randomUUID } from 'crypto';
import { getNeonSql, isNeonConfigured } from './neon';
import {
  decryptRecoverablePasscode,
  encryptRecoverablePasscode,
  hasRecoverablePasscodeEncryptionKey,
} from './passcodeCipher';
import { StockGameError } from './stockGameStore';

type StudentAliasRecord = {
  id: string;
  classroomCode: string;
  username: string;
  studentPasscode: string | null;
  isActive: boolean;
  createdAt: string;
};

type StudentAliasStoreState = {
  aliasesByClassAndName: Record<string, StudentAliasRecord>;
};

declare global {
  var __econSimsStudentAliasStore: StudentAliasStoreState | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyStore(): StudentAliasStoreState {
  return {
    aliasesByClassAndName: {},
  };
}

function getMemoryStore() {
  if (!globalThis.__econSimsStudentAliasStore) {
    globalThis.__econSimsStudentAliasStore = createEmptyStore();
  }

  return globalThis.__econSimsStudentAliasStore;
}

function normalizeClassroomCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function makeKey(classroomCode: string, username: string) {
  return `${classroomCode}::${username}`;
}

function readPasscodeFromRow(row: Record<string, unknown>) {
  return typeof row.student_passcode_encrypted === 'string'
    ? decryptRecoverablePasscode(row.student_passcode_encrypted)
    : null;
}

function assertStudentPasscodeStorageReady() {
  if (!isNeonConfigured()) {
    return;
  }

  if (!hasRecoverablePasscodeEncryptionKey()) {
    throw new StockGameError(
      'Missing STOCK_GAME_PASSCODE_ENCRYPTION_KEY for student credential storage.',
      500,
    );
  }
}

async function ensureAliasTable() {
  if (!isNeonConfigured()) {
    return;
  }

  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS stock_game_student_aliases (
      id TEXT PRIMARY KEY,
      classroom_code TEXT NOT NULL,
      username TEXT NOT NULL,
      student_passcode_encrypted TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (classroom_code, username)
    )
  `;

  await sql`
    ALTER TABLE stock_game_student_aliases
    ADD COLUMN IF NOT EXISTS student_passcode_encrypted TEXT
  `;

  await sql`
    ALTER TABLE stock_game_student_aliases
    DROP COLUMN IF EXISTS student_passcode
  `;
}

export async function upsertStudentAlias({
  classroomCode,
  username,
  studentPasscode,
  isActive = true,
}: {
  classroomCode: string;
  username: string;
  studentPasscode?: string | null;
  isActive?: boolean;
}) {
  const normalizedClassroomCode = normalizeClassroomCode(classroomCode);
  const normalizedUsername = normalizeUsername(username);

  if (!isNeonConfigured()) {
    const store = getMemoryStore();
    const key = makeKey(normalizedClassroomCode, normalizedUsername);
    const existing = store.aliasesByClassAndName[key];
    store.aliasesByClassAndName[key] = {
      id: existing?.id ?? randomUUID(),
      classroomCode: normalizedClassroomCode,
      username: normalizedUsername,
      studentPasscode: studentPasscode ?? existing?.studentPasscode ?? null,
      isActive,
      createdAt: existing?.createdAt ?? nowIso(),
    };
    return;
  }

  if (studentPasscode) {
    assertStudentPasscodeStorageReady();
  }

  await ensureAliasTable();
  const sql = getNeonSql();
  const encryptedPasscode = studentPasscode
    ? encryptRecoverablePasscode(studentPasscode)
    : null;
  if (studentPasscode && !encryptedPasscode) {
    throw new StockGameError(
      'Unable to encrypt student passcode for storage.',
      500,
    );
  }
  await sql`
    INSERT INTO stock_game_student_aliases (
      id,
      classroom_code,
      username,
      student_passcode_encrypted,
      is_active
    )
    VALUES (
      ${randomUUID()},
      ${normalizedClassroomCode},
      ${normalizedUsername},
      ${encryptedPasscode},
      ${isActive}
    )
    ON CONFLICT (classroom_code, username)
    DO UPDATE SET
      student_passcode_encrypted = COALESCE(
        EXCLUDED.student_passcode_encrypted,
        stock_game_student_aliases.student_passcode_encrypted
      ),
      is_active = EXCLUDED.is_active
  `;
}

export async function upsertStudentAliasesBulk(
  entries: Array<{
    classroomCode: string;
    username: string;
    studentPasscode?: string | null;
    isActive?: boolean;
  }>,
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  if (
    isNeonConfigured() &&
    entries.some((entry) => Boolean(entry.studentPasscode))
  ) {
    assertStudentPasscodeStorageReady();
  }

  const normalizedEntries = entries.map((entry) => ({
    id: randomUUID(),
    classroomCode: normalizeClassroomCode(entry.classroomCode),
    username: normalizeUsername(entry.username),
    studentPasscode: entry.studentPasscode ?? null,
    isActive: entry.isActive ?? true,
  }));

  if (!isNeonConfigured()) {
    const store = getMemoryStore();
    for (const entry of normalizedEntries) {
      const key = makeKey(entry.classroomCode, entry.username);
      const existing = store.aliasesByClassAndName[key];
      store.aliasesByClassAndName[key] = {
        id: existing?.id ?? entry.id,
        classroomCode: entry.classroomCode,
        username: entry.username,
        studentPasscode: entry.studentPasscode ?? existing?.studentPasscode ?? null,
        isActive: entry.isActive,
        createdAt: existing?.createdAt ?? nowIso(),
      };
    }
    return;
  }

  await ensureAliasTable();
  const sql = getNeonSql();
  const ids = normalizedEntries.map((entry) => entry.id);
  const classroomCodes = normalizedEntries.map((entry) => entry.classroomCode);
  const usernames = normalizedEntries.map((entry) => entry.username);
  const encryptedPasscodes = normalizedEntries.map((entry) =>
    entry.studentPasscode
      ? encryptRecoverablePasscode(entry.studentPasscode)
      : null,
  );
  if (
    normalizedEntries.some(
      (entry, index) => entry.studentPasscode && !encryptedPasscodes[index],
    )
  ) {
    throw new StockGameError(
      'Unable to encrypt student passcodes for storage.',
      500,
    );
  }
  const isActiveValues = normalizedEntries.map((entry) => entry.isActive);

  await sql`
    INSERT INTO stock_game_student_aliases (
      id,
      classroom_code,
      username,
      student_passcode_encrypted,
      is_active
    )
    SELECT *
    FROM UNNEST(
      ${ids}::text[],
      ${classroomCodes}::text[],
      ${usernames}::text[],
      ${encryptedPasscodes}::text[],
      ${isActiveValues}::boolean[]
    )
    ON CONFLICT (classroom_code, username)
    DO UPDATE SET
      student_passcode_encrypted = COALESCE(
        EXCLUDED.student_passcode_encrypted,
        stock_game_student_aliases.student_passcode_encrypted
      ),
      is_active = EXCLUDED.is_active
  `;
}

export async function deleteStudentAlias({
  classroomCode,
  username,
}: {
  classroomCode: string;
  username: string;
}) {
  const normalizedClassroomCode = normalizeClassroomCode(classroomCode);
  const normalizedUsername = normalizeUsername(username);

  if (!isNeonConfigured()) {
    const store = getMemoryStore();
    delete store.aliasesByClassAndName[
      makeKey(normalizedClassroomCode, normalizedUsername)
    ];
    return;
  }

  await ensureAliasTable();
  const sql = getNeonSql();
  await sql`
    DELETE FROM stock_game_student_aliases
    WHERE classroom_code = ${normalizedClassroomCode}
      AND username = ${normalizedUsername}
  `;
}

export async function setStudentAliasActive({
  classroomCode,
  username,
  isActive,
}: {
  classroomCode: string;
  username: string;
  isActive: boolean;
}) {
  return upsertStudentAlias({
    classroomCode,
    username,
    isActive,
  });
}

export async function listStudentAliasesByClassroom(classroomCode: string) {
  const normalizedClassroomCode = normalizeClassroomCode(classroomCode);

  if (!isNeonConfigured()) {
    const store = getMemoryStore();
    const aliases = Object.values(store.aliasesByClassAndName)
      .filter((alias) => alias.classroomCode === normalizedClassroomCode)
      .sort((a, b) => a.username.localeCompare(b.username));

    return {
      aliases,
      storage: 'memory' as const,
    };
  }

  await ensureAliasTable();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT
      id,
      classroom_code,
      username,
      student_passcode_encrypted,
      is_active,
      created_at
    FROM stock_game_student_aliases
    WHERE classroom_code = ${normalizedClassroomCode}
    ORDER BY username ASC
  `;

  const rowArray: unknown[] = Array.isArray(rows) ? rows : [];

  return {
    aliases: rowArray
      .filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === 'object' && !Array.isArray(row),
      )
      .map((row) => ({
        id: String(row.id ?? ''),
        classroomCode: String(row.classroom_code ?? normalizedClassroomCode),
        username: String(row.username ?? ''),
        studentPasscode: readPasscodeFromRow(row),
        isActive: Boolean(row.is_active),
        createdAt: new Date(String(row.created_at ?? nowIso())).toISOString(),
      })),
    storage: 'neon' as const,
  };
}

export function __resetStudentAliasStore() {
  delete globalThis.__econSimsStudentAliasStore;
}

export function verifyStudentAliasPasscodeStorage() {
  assertStudentPasscodeStorageReady();
}
