import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import {
  createTeacherClassroom,
  listTeacherClassrooms,
} from '@/lib/teacherStore';
import { ensureTeacherClassroom } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

type CreateTeacherClassroomBody = {
  title?: string;
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
    if (error instanceof TeacherAuthError) {
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
    );
    await ensureTeacherClassroom({
      classroomCode: classroom.code,
      teacherUserId,
      title: classroom.title,
    });

    return NextResponse.json(classroom, { status: 201 });
  } catch (error) {
    if (error instanceof TeacherAuthError) {
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
