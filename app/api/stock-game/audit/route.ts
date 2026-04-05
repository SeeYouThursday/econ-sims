import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import { assertTeacherOwnsClassroom } from '@/lib/teacherStore';
import {
  ensureTeacherClassroom,
  getTeacherAudit,
  StockGameError,
} from '@/lib/stockGameStore';

export const runtime = 'nodejs';

type AuditBody = {
  classroomCode?: string;
  teacherPasscode?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuditBody;
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

    const audit = await getTeacherAudit({
      classroomCode: body.classroomCode ?? '',
      teacherPasscode: body.teacherPasscode ?? '',
      teacherUserId: teacherUserId ?? undefined,
    });

    return NextResponse.json(audit);
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
      { error: 'Unexpected error while loading classroom audit data.' },
      { status: 500 },
    );
  }
}
