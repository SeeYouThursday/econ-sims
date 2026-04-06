import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import { assertTeacherOwnsClassroom } from '@/lib/teacherStore';
import {
  createStudent,
  deleteStudent,
  ensureTeacherClassroom,
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

    const result = await deleteStudent({
      classroomCode: body.classroomCode ?? '',
      teacherPasscode: body.teacherPasscode ?? '',
      teacherUserId: teacherUserId ?? undefined,
      username: body.username ?? '',
    });

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
