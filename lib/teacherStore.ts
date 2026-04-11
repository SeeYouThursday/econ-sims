import { randomInt, randomUUID } from 'crypto';
import { getNeonSql, isNeonConfigured } from './neon';

type TeacherRecord = {
  id: string;
  clerkUserId: string;
  createdAt: string;
};

type TeacherClassroomRecord = {
  id: string;
  teacherId: string;
  code: string;
  title: string;
  startingCash: number;
  durationDays: number;
  createdAt: string;
};

type TeacherStoreState = {
  teachersByClerkUserId: Record<string, TeacherRecord>;
  classroomsByCode: Record<string, TeacherClassroomRecord>;
};

declare global {
  var __econSimsTeacherStore: TeacherStoreState | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyTeacherStore(): TeacherStoreState {
  return {
    teachersByClerkUserId: {},
    classroomsByCode: {},
  };
}

function getMemoryTeacherStore() {
  if (!globalThis.__econSimsTeacherStore) {
    globalThis.__econSimsTeacherStore = createEmptyTeacherStore();
  }

  return globalThis.__econSimsTeacherStore;
}

function validateClassroomTitle(title: string) {
  const trimmed = title.trim();
  if (trimmed.length < 3 || trimmed.length > 80) {
    throw new Error('Classroom title must be between 3 and 80 characters.');
  }

  return trimmed;
}

const DEFAULT_STARTING_CASH = 10000;

function validateStartingCash(startingCash: unknown) {
  const parsed =
    typeof startingCash === 'number'
      ? startingCash
      : Number(startingCash ?? DEFAULT_STARTING_CASH);

  if (!Number.isFinite(parsed) || parsed < 100 || parsed > 1_000_000) {
    throw new Error('Starting cash must be between 100 and 1,000,000.');
  }

  return Math.trunc(parsed);
}

const DEFAULT_DURATION_DAYS = 30;

function validateDurationDays(durationDays: unknown) {
  const parsed =
    typeof durationDays === 'number'
      ? durationDays
      : Number(durationDays ?? DEFAULT_DURATION_DAYS);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
    throw new Error('Game duration must be between 1 and 365 days.');
  }

  return Math.trunc(parsed);
}

function normalizeClassroomCode(code: string) {
  return code.trim().toUpperCase();
}

function generateClassroomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < 6; index += 1) {
    const randomIndex = randomInt(0, alphabet.length);
    result += alphabet[randomIndex];
  }
  return result;
}

function toObjectRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object' && !Array.isArray(row),
  );
}

async function ensureTeacherTables() {
  if (!isNeonConfigured()) {
    return;
  }

  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS stock_game_teachers (
      id TEXT PRIMARY KEY,
      clerk_user_id TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stock_game_classrooms (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES stock_game_teachers(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      starting_cash INTEGER NOT NULL DEFAULT 10000,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE stock_game_classrooms
    ADD COLUMN IF NOT EXISTS starting_cash INTEGER NOT NULL DEFAULT 10000
  `;

  await sql`
    ALTER TABLE stock_game_classrooms
    ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30
  `;
}

export async function requireTeacherRecord(
  clerkUserId: string,
): Promise<TeacherRecord> {
  return getOrCreateTeacherRecord(clerkUserId);
}

export async function provisionTeacherRecord(clerkUserId: string) {
  return getOrCreateTeacherRecord(clerkUserId);
}

async function getOrCreateTeacherRecord(
  clerkUserId: string,
): Promise<TeacherRecord> {
  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    const existing = store.teachersByClerkUserId[clerkUserId];
    if (existing) {
      return existing;
    }

    const created: TeacherRecord = {
      id: randomUUID(),
      clerkUserId,
      createdAt: nowIso(),
    };
    store.teachersByClerkUserId[clerkUserId] = created;
    return created;
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql`
    INSERT INTO stock_game_teachers (id, clerk_user_id)
    VALUES (${randomUUID()}, ${clerkUserId})
    ON CONFLICT (clerk_user_id) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
    RETURNING id, clerk_user_id, created_at
  `;

  const teacher = toObjectRows(rows)[0];
  if (!teacher) {
    throw new Error('Unable to load teacher record.');
  }

  return {
    id: String(teacher.id ?? ''),
    clerkUserId: String(teacher.clerk_user_id ?? ''),
    createdAt: new Date(String(teacher.created_at ?? nowIso())).toISOString(),
  };
}

async function classroomCodeExists(code: string) {
  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    return Boolean(store.classroomsByCode[code]);
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT code
    FROM stock_game_classrooms
    WHERE code = ${code}
    LIMIT 1
  `;
  return toObjectRows(rows).length > 0;
}

async function generateUniqueClassroomCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateClassroomCode();
    if (!(await classroomCodeExists(code))) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique classroom code.');
}

export async function listTeacherClassrooms(clerkUserId: string) {
  const teacher = await requireTeacherRecord(clerkUserId);

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    return Object.values(store.classroomsByCode)
      .filter((classroom) => classroom.teacherId === teacher.id)
      .map((classroom) => ({
        ...classroom,
        startingCash: validateStartingCash(classroom.startingCash),
        durationDays: validateDurationDays(classroom.durationDays),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, teacher_id, code, title, starting_cash, duration_days, created_at
    FROM stock_game_classrooms
    WHERE teacher_id = ${teacher.id}
    ORDER BY created_at ASC
  `;

  return toObjectRows(rows).map((row) => ({
    id: String(row.id ?? ''),
    teacherId: String(row.teacher_id ?? ''),
    code: String(row.code ?? ''),
    title: String(row.title ?? ''),
    startingCash: validateStartingCash(row.starting_cash),
    durationDays: validateDurationDays(row.duration_days),
    createdAt: new Date(String(row.created_at ?? nowIso())).toISOString(),
  }));
}

export async function createTeacherClassroom(
  clerkUserId: string,
  titleInput: string,
  startingCashInput?: unknown,
  durationDaysInput?: unknown,
) {
  const teacher = await requireTeacherRecord(clerkUserId);
  const title = validateClassroomTitle(titleInput);
  const startingCash = validateStartingCash(startingCashInput);
  const durationDays = validateDurationDays(durationDaysInput);
  const code = await generateUniqueClassroomCode();

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    const classroom: TeacherClassroomRecord = {
      id: randomUUID(),
      teacherId: teacher.id,
      code,
      title,
      startingCash,
      durationDays,
      createdAt: nowIso(),
    };
    store.classroomsByCode[classroom.code] = classroom;
    return classroom;
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql`
    INSERT INTO stock_game_classrooms (id, teacher_id, code, title, starting_cash, duration_days)
    VALUES (${randomUUID()}, ${teacher.id}, ${code}, ${title}, ${startingCash}, ${durationDays})
    RETURNING id, teacher_id, code, title, starting_cash, duration_days, created_at
  `;

  const classroom = toObjectRows(rows)[0];
  if (!classroom) {
    throw new Error('Unable to create classroom.');
  }

  return {
    id: String(classroom.id ?? ''),
    teacherId: String(classroom.teacher_id ?? ''),
    code: String(classroom.code ?? ''),
    title: String(classroom.title ?? ''),
    startingCash: validateStartingCash(classroom.starting_cash),
    durationDays: validateDurationDays(classroom.duration_days),
    createdAt: new Date(String(classroom.created_at ?? nowIso())).toISOString(),
  };
}

export async function assertTeacherOwnsClassroom(
  clerkUserId: string,
  classroomCodeInput: string,
) {
  const teacher = await requireTeacherRecord(clerkUserId);
  const classroomCode = normalizeClassroomCode(classroomCodeInput);

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    const classroom = store.classroomsByCode[classroomCode];
    if (!classroom || classroom.teacherId !== teacher.id) {
      throw new Error('Teacher does not own this classroom.');
    }
    classroom.startingCash = validateStartingCash(classroom.startingCash);
    classroom.durationDays = validateDurationDays(classroom.durationDays);
    return classroom;
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, teacher_id, code, title, starting_cash, duration_days, created_at
    FROM stock_game_classrooms
    WHERE code = ${classroomCode}
      AND teacher_id = ${teacher.id}
    LIMIT 1
  `;

  const classroom = toObjectRows(rows)[0];
  if (!classroom) {
    throw new Error('Teacher does not own this classroom.');
  }

  return {
    id: String(classroom.id ?? ''),
    teacherId: String(classroom.teacher_id ?? ''),
    code: String(classroom.code ?? ''),
    title: String(classroom.title ?? ''),
    startingCash: validateStartingCash(classroom.starting_cash),
    durationDays: validateDurationDays(classroom.duration_days),
    createdAt: new Date(String(classroom.created_at ?? nowIso())).toISOString(),
  };
}

export async function updateTeacherClassroomStartingCash(
  clerkUserId: string,
  classroomCodeInput: string,
  startingCashInput: unknown,
) {
  const teacher = await requireTeacherRecord(clerkUserId);
  const classroomCode = normalizeClassroomCode(classroomCodeInput);
  const startingCash = validateStartingCash(startingCashInput);

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    const classroom = store.classroomsByCode[classroomCode];
    if (!classroom || classroom.teacherId !== teacher.id) {
      throw new Error('Teacher does not own this classroom.');
    }

    classroom.startingCash = startingCash;
    return classroom;
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql`
    UPDATE stock_game_classrooms
    SET starting_cash = ${startingCash}
    WHERE code = ${classroomCode}
      AND teacher_id = ${teacher.id}
    RETURNING id, teacher_id, code, title, starting_cash, duration_days, created_at
  `;

  const classroom = toObjectRows(rows)[0];
  if (!classroom) {
    throw new Error('Teacher does not own this classroom.');
  }

  return {
    id: String(classroom.id ?? ''),
    teacherId: String(classroom.teacher_id ?? ''),
    code: String(classroom.code ?? ''),
    title: String(classroom.title ?? ''),
    startingCash: validateStartingCash(classroom.starting_cash),
    durationDays: validateDurationDays(classroom.duration_days),
    createdAt: new Date(String(classroom.created_at ?? nowIso())).toISOString(),
  };
}

export function __resetTeacherStore() {
  delete globalThis.__econSimsTeacherStore;
}
