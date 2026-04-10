import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import {
  assertTeacherOwnsClassroom,
  TeacherAccessError,
} from '@/lib/teacherStore';
import {
  deleteStudentAlias,
  setStudentAliasActive,
  upsertStudentAlias,
  upsertStudentAliasesBulk,
} from '@/lib/studentAliasStore';
import {
  createStudent,
  createStudentsBatch,
  deleteStudent,
  ensureTeacherClassroom,
  listStudentsForClassroom,
  manageClassroomStudents,
  manageStudent,
  StockGameError,
} from '@/lib/stockGameStore';
import {
  isClassroomNotFoundError,
  logStockGameFallback,
  safeListStudentAliasesWithFallback,
} from '../fallbacks';

export const runtime = 'nodejs';

type CreateStudentBody = {
  classroomCode?: string;
  teacherPasscode?: string;
  username?: string;
  studentPasscode?: string;
  students?: Array<{
    username?: string;
    studentPasscode?: string;
  }>;
};

type DeleteStudentBody = {
  classroomCode?: string;
  teacherPasscode?: string;
  username?: string;
};

type ListStudentsQuery = {
  classroomCode?: string;
  teacherPasscode?: string;
  format?: string;
};

type UpdateStudentBody = {
  classroomCode?: string;
  teacherPasscode?: string;
  username?: string;
  action?: 'reset' | 'deactivate' | 'activate' | 'reset-all';
};

type InternalRosterStudent = {
  studentId: string;
  username: string;
  studentPasscode: string | null;
  createdAt: string;
  isActive: boolean;
  cash: number;
  holdingsValue: number;
  totalValue: number;
  hasActiveSession: boolean;
};

type RosterStudent = Omit<InternalRosterStudent, 'studentPasscode'>;

type RosterResponse = {
  classroomCode: string;
  asOf: string;
  studentCount: number;
  students: RosterStudent[];
  piiIncluded: boolean;
  storage: string;
};

function buildRosterStudent(
  alias: {
    id: string;
    username: string;
    createdAt: string;
    isActive: boolean;
  },
  stock?: InternalRosterStudent,
): InternalRosterStudent {
  if (stock) {
    return {
      ...stock,
      studentId: stock.studentId || alias.id,
      createdAt: stock.createdAt || alias.createdAt,
      isActive: alias.isActive,
    };
  }

  return {
    studentId: alias.id,
    username: alias.username,
    studentPasscode: null,
    createdAt: alias.createdAt,
    isActive: alias.isActive,
    cash: 0,
    holdingsValue: 0,
    totalValue: 0,
    hasActiveSession: false,
  };
}

function buildRosterResponse({
  classroomCode,
  aliases,
  storage,
  stockRoster,
}: {
  classroomCode: string;
  aliases: Array<{
    id: string;
    username: string;
    createdAt: string;
    isActive: boolean;
  }>;
  storage: string;
  stockRoster: {
    asOf: string;
    students: InternalRosterStudent[];
  } | null;
}) {
  const stockByUsername = new Map(
    (stockRoster?.students ?? []).map((student) => [student.username, student]),
  );

  const students = aliases
    .map((alias) =>
      buildRosterStudent(alias, stockByUsername.get(alias.username)),
    )
    .sort((a, b) => a.username.localeCompare(b.username));

  return {
    classroomCode,
    asOf: stockRoster?.asOf ?? new Date().toISOString(),
    studentCount: students.length,
    students,
    piiIncluded: false,
    storage,
  };
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildStudentsCsv({
  classroomCode,
  students,
}: {
  classroomCode: string;
  students: InternalRosterStudent[];
}) {
  const header = ['classroomCode', 'alias', 'passcode', 'active', 'createdAt'];

  const rows = students.map((student) => [
    classroomCode,
    student.username,
    student.studentPasscode ?? '',
    student.isActive,
    student.createdAt,
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
    .join('\n');
}

async function runWithTeacherClassroomResync<T>({
  classroomCode,
  teacherUserId,
  run,
}: {
  classroomCode: string;
  teacherUserId: string | null;
  run: () => Promise<T>;
}) {
  try {
    return await run();
  } catch (error) {
    if (teacherUserId && isClassroomNotFoundError(error)) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        classroomCode,
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });

      return run();
    }

    throw error;
  }
}

async function createStudentWithTeacherResync(
  body: CreateStudentBody,
  teacherUserId: string | null,
) {
  const createInput = {
    classroomCode: body.classroomCode ?? '',
    teacherPasscode: body.teacherPasscode ?? '',
    teacherUserId: teacherUserId ?? undefined,
    username: body.username ?? '',
    studentPasscode: body.studentPasscode ?? '',
  };

  try {
    return await createStudent(createInput);
  } catch (error) {
    // If game state lost this classroom between requests, re-sync once from the
    // teacher ownership source of truth, then retry student creation.
    if (teacherUserId && isClassroomNotFoundError(error)) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        body.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });

      return createStudent(createInput);
    }

    throw error;
  }
}

async function createStudentsBatchWithTeacherResync(
  body: CreateStudentBody,
  teacherUserId: string | null,
) {
  const createInput = {
    classroomCode: body.classroomCode ?? '',
    teacherPasscode: body.teacherPasscode ?? '',
    teacherUserId: teacherUserId ?? undefined,
    students: (body.students ?? []).map((student) => ({
      username: student.username ?? '',
      studentPasscode: student.studentPasscode ?? '',
    })),
  };

  try {
    return await createStudentsBatch(createInput);
  } catch (error) {
    if (teacherUserId && isClassroomNotFoundError(error)) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        body.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });

      return createStudentsBatch(createInput);
    }

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateStudentBody;
    const teacherUserId = await requireTeacherAuth();

    if (teacherUserId) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        body.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });
    }

    if (Array.isArray(body.students)) {
      const result = await createStudentsBatchWithTeacherResync(
        body,
        teacherUserId,
      );

      try {
        await upsertStudentAliasesBulk(
          result.students.map((student) => ({
            classroomCode: student.classroomCode,
            username: student.username,
            isActive: true,
          })),
        );
      } catch {
        // Alias registry sync is best-effort and should not block student creation.
      }

      return NextResponse.json(result, { status: 201 });
    }

    const student = await createStudentWithTeacherResync(body, teacherUserId);
    try {
      await upsertStudentAlias({
        classroomCode: student.classroomCode,
        username: student.username,
        isActive: true,
      });
    } catch {
      // Alias registry sync is best-effort and should not block student creation.
    }

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    if (
      error instanceof TeacherAuthError ||
      error instanceof TeacherAccessError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while creating student account.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteStudentBody;
    const teacherUserId = await requireTeacherAuth();

    if (teacherUserId) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        body.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });
    }

    const classroomCode = body.classroomCode ?? '';
    const username = body.username ?? '';
    let result:
      | {
          classroomCode: string;
          username: string;
          deleted: boolean;
          storage: string;
        }
      | undefined;

    try {
      result = await runWithTeacherClassroomResync({
        classroomCode,
        teacherUserId,
        run: async () =>
          deleteStudent({
            classroomCode,
            teacherPasscode: body.teacherPasscode ?? '',
            teacherUserId: teacherUserId ?? undefined,
            username,
          }),
      });
    } catch (error) {
      if (
        error instanceof StockGameError &&
        error.status === 404 &&
        error.message.includes('Student account was not found')
      ) {
        // Keep teacher delete idempotent across stock-state and alias-store drift.
        result = {
          classroomCode,
          username,
          deleted: true,
          storage: 'alias-only',
        };
      } else {
        throw error;
      }
    }

    if (!result) {
      throw new StockGameError(
        'Unexpected error while deleting student account.',
        500,
      );
    }

    try {
      await deleteStudentAlias({
        classroomCode: result.classroomCode,
        username: result.username,
      });
    } catch {
      // Alias registry sync is best-effort and should not block deletion.
    }

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof TeacherAuthError ||
      error instanceof TeacherAccessError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while deleting student account.' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = {
      classroomCode: url.searchParams.get('classroomCode') ?? undefined,
      teacherPasscode: url.searchParams.get('teacherPasscode') ?? undefined,
      format: url.searchParams.get('format') ?? undefined,
    } as ListStudentsQuery;
    const teacherUserId = await requireTeacherAuth();

    if (teacherUserId) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        query.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });
    }

    const classroomCode = query.classroomCode ?? '';
    const aliasData = await safeListStudentAliasesWithFallback(
      'students',
      classroomCode,
    );

    let stockRoster: {
      asOf: string;
      students: InternalRosterStudent[];
    } | null = null;
    try {
      stockRoster = await runWithTeacherClassroomResync({
        classroomCode,
        teacherUserId,
        run: async () =>
          listStudentsForClassroom({
            classroomCode,
            teacherPasscode: query.teacherPasscode,
            teacherUserId: teacherUserId ?? undefined,
          }),
      });
    } catch (error) {
      if (teacherUserId && isClassroomNotFoundError(error)) {
        logStockGameFallback('students', 'stock_roster_unavailable', {
          classroomCode,
          teacherUserId,
        });
        stockRoster = null;
      } else {
        throw error;
      }
    }

    const rosterWithSecrets = buildRosterResponse({
      classroomCode,
      aliases: aliasData.aliases,
      storage: aliasData.storage,
      stockRoster,
    });

    if (query.format === 'csv') {
      const csv = buildStudentsCsv({
        classroomCode,
        students: rosterWithSecrets.students,
      });
      const generatedAt = new Date().toISOString();

      console.info('[stock-game][students] export', {
        classroomCode,
        teacherUserId,
        studentCount: rosterWithSecrets.studentCount,
        format: 'csv',
        generatedAt,
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${classroomCode.toLowerCase()}-student-credentials.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const roster: RosterResponse = {
      classroomCode: rosterWithSecrets.classroomCode,
      asOf: rosterWithSecrets.asOf,
      studentCount: rosterWithSecrets.studentCount,
      students: rosterWithSecrets.students.map((student) => ({
        studentId: student.studentId,
        username: student.username,
        createdAt: student.createdAt,
        isActive: student.isActive,
        cash: student.cash,
        holdingsValue: student.holdingsValue,
        totalValue: student.totalValue,
        hasActiveSession: student.hasActiveSession,
      })),
      piiIncluded: false,
      storage: rosterWithSecrets.storage,
    };

    return NextResponse.json(roster);
  } catch (error) {
    if (
      error instanceof TeacherAuthError ||
      error instanceof TeacherAccessError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while listing classroom students.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UpdateStudentBody;
    const teacherUserId = await requireTeacherAuth();

    if (teacherUserId) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        body.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
        startingCash: classroom.startingCash,
      });
    }

    if (!body.action) {
      throw new StockGameError('Student action is required.');
    }

    const action = body.action;

    if (action === 'reset-all') {
      const classroomCode = body.classroomCode ?? '';
      const result = await runWithTeacherClassroomResync({
        classroomCode,
        teacherUserId,
        run: async () =>
          manageClassroomStudents({
            classroomCode,
            teacherPasscode: body.teacherPasscode,
            teacherUserId: teacherUserId ?? undefined,
            action,
          }),
      });

      return NextResponse.json(result);
    }

    const classroomCode = body.classroomCode ?? '';
    const result = await runWithTeacherClassroomResync({
      classroomCode,
      teacherUserId,
      run: async () =>
        manageStudent({
          classroomCode,
          teacherPasscode: body.teacherPasscode,
          teacherUserId: teacherUserId ?? undefined,
          username: body.username ?? '',
          action,
        }),
    });

    if (action === 'deactivate' || action === 'activate') {
      try {
        await setStudentAliasActive({
          classroomCode: result.classroomCode,
          username: result.username,
          isActive: action === 'activate',
        });
      } catch {
        // Alias registry sync is best-effort and should not block account updates.
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof TeacherAuthError ||
      error instanceof TeacherAccessError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while updating student account.' },
      { status: 500 },
    );
  }
}
