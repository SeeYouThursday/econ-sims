import { randomUUID } from 'crypto';
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

function normalizeClassroomCode(code: string) {
  return code.trim().toUpperCase();
}

function generateClassroomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < 6; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    result += alphabet[randomIndex];
  }
  return result;
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
  const rows = await sql<{
    id: string;
    clerk_user_id: string;
    created_at: string;
  }>`
    INSERT INTO stock_game_teachers (id, clerk_user_id)
    VALUES (${randomUUID()}, ${clerkUserId})
    ON CONFLICT (clerk_user_id) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
    RETURNING id, clerk_user_id, created_at
  `;

  const teacher = rows[0];
  if (!teacher) {
    throw new Error('Unable to load teacher record.');
  }

  return {
    id: teacher.id,
    clerkUserId: teacher.clerk_user_id,
    createdAt: new Date(teacher.created_at).toISOString(),
  };
}

async function classroomCodeExists(code: string) {
  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    return Boolean(store.classroomsByCode[code]);
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql<{ code: string }>`
    SELECT code
    FROM stock_game_classrooms
    WHERE code = ${code}
    LIMIT 1
  `;
  return rows.length > 0;
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
  const teacher = await getOrCreateTeacherRecord(clerkUserId);

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    return Object.values(store.classroomsByCode)
      .filter((classroom) => classroom.teacherId === teacher.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql<{
    id: string;
    teacher_id: string;
    code: string;
    title: string;
    created_at: string;
  }>`
    SELECT id, teacher_id, code, title, created_at
    FROM stock_game_classrooms
    WHERE teacher_id = ${teacher.id}
    ORDER BY created_at ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    teacherId: row.teacher_id,
    code: row.code,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function createTeacherClassroom(
  clerkUserId: string,
  titleInput: string,
) {
  const teacher = await getOrCreateTeacherRecord(clerkUserId);
  const title = validateClassroomTitle(titleInput);
  const code = await generateUniqueClassroomCode();

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    const classroom: TeacherClassroomRecord = {
      id: randomUUID(),
      teacherId: teacher.id,
      code,
      title,
      createdAt: nowIso(),
    };
    store.classroomsByCode[classroom.code] = classroom;
    return classroom;
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql<{
    id: string;
    teacher_id: string;
    code: string;
    title: string;
    created_at: string;
  }>`
    INSERT INTO stock_game_classrooms (id, teacher_id, code, title)
    VALUES (${randomUUID()}, ${teacher.id}, ${code}, ${title})
    RETURNING id, teacher_id, code, title, created_at
  `;

  const classroom = rows[0];
  if (!classroom) {
    throw new Error('Unable to create classroom.');
  }

  return {
    id: classroom.id,
    teacherId: classroom.teacher_id,
    code: classroom.code,
    title: classroom.title,
    createdAt: new Date(classroom.created_at).toISOString(),
  };
}

export async function assertTeacherOwnsClassroom(
  clerkUserId: string,
  classroomCodeInput: string,
) {
  const teacher = await getOrCreateTeacherRecord(clerkUserId);
  const classroomCode = normalizeClassroomCode(classroomCodeInput);

  if (!isNeonConfigured()) {
    const store = getMemoryTeacherStore();
    const classroom = store.classroomsByCode[classroomCode];
    if (!classroom || classroom.teacherId !== teacher.id) {
      throw new Error('Teacher does not own this classroom.');
    }
    return classroom;
  }

  await ensureTeacherTables();
  const sql = getNeonSql();
  const rows = await sql<{
    id: string;
    teacher_id: string;
    code: string;
    title: string;
    created_at: string;
  }>`
    SELECT id, teacher_id, code, title, created_at
    FROM stock_game_classrooms
    WHERE code = ${classroomCode}
      AND teacher_id = ${teacher.id}
    LIMIT 1
  `;

  const classroom = rows[0];
  if (!classroom) {
    throw new Error('Teacher does not own this classroom.');
  }

  return {
    id: classroom.id,
    teacherId: classroom.teacher_id,
    code: classroom.code,
    title: classroom.title,
    createdAt: new Date(classroom.created_at).toISOString(),
  };
}

export function __resetTeacherStore() {
  delete globalThis.__econSimsTeacherStore;
}
