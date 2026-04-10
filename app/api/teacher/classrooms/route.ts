import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import {
  createTeacherClassroom,
  listTeacherClassrooms,
  TeacherAccessError,
  updateTeacherClassroomStartingCash,
} from '@/lib/teacherStore';
import { ensureTeacherClassroom } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

type CreateTeacherClassroomBody = {
  title?: string;
  startingCash?: number;
};

type UpdateTeacherClassroomBody = {
  classroomCode?: string;
  startingCash?: number;
};

export async function GET() {
  try {
    const teacherUserId = await requireTeacherAuth();
    if (!teacherUserId) {
      throw new TeacherAuthError('Teacher sign-in is required.', 401);
    }

    const classrooms = await listTeacherClassrooms(teacherUserId);
    return NextResponse.json(classrooms);
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

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to load classrooms.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const teacherUserId = await requireTeacherAuth();
    if (!teacherUserId) {
      throw new TeacherAuthError('Teacher sign-in is required.', 401);
    }

    const body = (await request.json()) as CreateTeacherClassroomBody;
    const classroom = await createTeacherClassroom(
      teacherUserId,
      body.title ?? '',
      body.startingCash,
    );
    await ensureTeacherClassroom({
      classroomCode: classroom.code,
      teacherUserId,
      title: classroom.title,
      startingCash: classroom.startingCash,
    });

    return NextResponse.json(classroom, { status: 201 });
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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create classroom.',
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const teacherUserId = await requireTeacherAuth();
    if (!teacherUserId) {
      throw new TeacherAuthError('Teacher sign-in is required.', 401);
    }

    const body = (await request.json()) as UpdateTeacherClassroomBody;
    const classroom = await updateTeacherClassroomStartingCash(
      teacherUserId,
      body.classroomCode ?? '',
      body.startingCash,
    );

    await ensureTeacherClassroom({
      classroomCode: classroom.code,
      teacherUserId,
      title: classroom.title,
      startingCash: classroom.startingCash,
    });

    return NextResponse.json(classroom);
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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update classroom settings.',
      },
      { status: 400 },
    );
  }
}
