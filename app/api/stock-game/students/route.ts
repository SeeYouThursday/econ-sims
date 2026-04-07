import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import { assertTeacherOwnsClassroom } from '@/lib/teacherStore';
import {
  deleteStudentAlias,
  listStudentAliasesByClassroom,
  setStudentAliasActive,
  upsertStudentAlias,
} from '@/lib/studentAliasStore';
import {
  createStudent,
  deleteStudent,
  ensureTeacherClassroom,
  listStudentsForClassroom,
  manageStudent,
  StockGameError,
} from '@/lib/stockGameStore';

export const runtime = 'nodejs';

type CreateStudentBody = {
  classroomCode?: string;
  teacherPasscode?: string;
  username?: string;
  studentPasscode?: string;
};

type DeleteStudentBody = {
  classroomCode?: string;
  teacherPasscode?: string;
  username?: string;
};

type ListStudentsQuery = {
  classroomCode?: string;
  teacherPasscode?: string;
};

type UpdateStudentBody = {
  classroomCode?: string;
  teacherPasscode?: string;
  username?: string;
  action?: 'reset' | 'deactivate' | 'activate';
};

type RosterStudent = {
  studentId: string;
  username: string;
  createdAt: string;
  isActive: boolean;
  cash: number;
  holdingsValue: number;
  totalValue: number;
  hasActiveSession: boolean;
};

type RosterResponse = {
  classroomCode: string;
  asOf: string;
  studentCount: number;
  students: RosterStudent[];
  piiIncluded: boolean;
  storage: string;
};

async function safeListStudentAliases(classroomCode: string) {
  try {
    return await listStudentAliasesByClassroom(classroomCode);
  } catch {
    return {
      aliases: [],
      storage: 'memory' as const,
    };
  }
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
    if (
      teacherUserId &&
      error instanceof StockGameError &&
      error.status === 404 &&
      error.message === 'Classroom was not found.'
    ) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        classroomCode,
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
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
    if (
      teacherUserId &&
      error instanceof StockGameError &&
      error.status === 404 &&
      error.message === 'Classroom was not found.'
    ) {
      const classroom = await assertTeacherOwnsClassroom(
        teacherUserId,
        body.classroomCode ?? '',
      );
      await ensureTeacherClassroom({
        classroomCode: classroom.code,
        teacherUserId,
        title: classroom.title,
      });

      return createStudent(createInput);
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
      });
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
    if (error instanceof TeacherAuthError) {
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
      });
    }

    const classroomCode = body.classroomCode ?? '';
    const result = await runWithTeacherClassroomResync({
      classroomCode,
      teacherUserId,
      run: async () =>
        deleteStudent({
          classroomCode,
          teacherPasscode: body.teacherPasscode ?? '',
          teacherUserId: teacherUserId ?? undefined,
          username: body.username ?? '',
        }),
    });

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
    if (error instanceof TeacherAuthError) {
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
      });
    }

    const classroomCode = query.classroomCode ?? '';
    const aliasData = await safeListStudentAliases(classroomCode);

    let stockRoster: RosterResponse | null = null;
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
      if (
        teacherUserId &&
        error instanceof StockGameError &&
        error.status === 404 &&
        error.message === 'Classroom was not found.'
      ) {
        stockRoster = null;
      } else {
        throw error;
      }
    }

    const stockByUsername = new Map(
      (stockRoster?.students ?? []).map((student) => [
        student.username,
        student,
      ]),
    );

    const students: RosterStudent[] = aliasData.aliases.map((alias) => {
      const stock = stockByUsername.get(alias.username);
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
        createdAt: alias.createdAt,
        isActive: alias.isActive,
        cash: 0,
        holdingsValue: 0,
        totalValue: 0,
        hasActiveSession: false,
      };
    });

    students.sort((a, b) => a.username.localeCompare(b.username));

    const roster: RosterResponse = {
      classroomCode,
      asOf: stockRoster?.asOf ?? new Date().toISOString(),
      studentCount: students.length,
      students,
      piiIncluded: false,
      storage: aliasData.storage,
    };

    return NextResponse.json(roster);
  } catch (error) {
    if (error instanceof TeacherAuthError) {
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
      });
    }

    if (!body.action) {
      throw new StockGameError('Student action is required.');
    }

    const action = body.action;

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
    if (error instanceof TeacherAuthError) {
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
