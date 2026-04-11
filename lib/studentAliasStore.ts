import { randomUUID } from 'crypto';
import { getNeonSql, isNeonConfigured } from './neon';

type StudentAliasRecord = {
  id: string;
  classroomCode: string;
  username: string;
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
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (classroom_code, username)
    )
  `;
}

export async function upsertStudentAlias({
  classroomCode,
  username,
  isActive = true,
}: {
  classroomCode: string;
  username: string;
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
      isActive,
      createdAt: existing?.createdAt ?? nowIso(),
    };
    return;
  }

  await ensureAliasTable();
  const sql = getNeonSql();
  await sql`
    INSERT INTO stock_game_student_aliases (id, classroom_code, username, is_active)
    VALUES (${randomUUID()}, ${normalizedClassroomCode}, ${normalizedUsername}, ${isActive})
    ON CONFLICT (classroom_code, username)
    DO UPDATE SET is_active = EXCLUDED.is_active
  `;
}

export async function upsertStudentAliasesBulk(
  entries: Array<{
    classroomCode: string;
    username: string;
    isActive?: boolean;
  }>,
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  const normalizedEntries = entries.map((entry) => ({
    id: randomUUID(),
    classroomCode: normalizeClassroomCode(entry.classroomCode),
    username: normalizeUsername(entry.username),
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
  const isActiveValues = normalizedEntries.map((entry) => entry.isActive);

  await sql`
    INSERT INTO stock_game_student_aliases (id, classroom_code, username, is_active)
    SELECT *
    FROM UNNEST(
      ${ids}::text[],
      ${classroomCodes}::text[],
      ${usernames}::text[],
      ${isActiveValues}::boolean[]
    )
    ON CONFLICT (classroom_code, username)
    DO UPDATE SET is_active = EXCLUDED.is_active
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
    SELECT id, classroom_code, username, is_active, created_at
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
        isActive: Boolean(row.is_active),
        createdAt: new Date(String(row.created_at ?? nowIso())).toISOString(),
      })),
    storage: 'neon' as const,
  };
}

export function __resetStudentAliasStore() {
  delete globalThis.__econSimsStudentAliasStore;
}
