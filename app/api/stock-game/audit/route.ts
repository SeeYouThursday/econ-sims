import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import { assertTeacherOwnsClassroom } from '@/lib/teacherStore';
import { listStudentAliasesByClassroom } from '@/lib/studentAliasStore';
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

async function getAuditWithTeacherResync(
  body: AuditBody,
  teacherUserId: string | null,
) {
  const auditInput = {
    classroomCode: body.classroomCode ?? '',
    teacherPasscode: body.teacherPasscode ?? '',
    teacherUserId: teacherUserId ?? undefined,
  };

  try {
    return await getTeacherAudit(auditInput);
  } catch (error) {
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

      return getTeacherAudit(auditInput);
    }

    throw error;
  }
}

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

    const classroomCode = body.classroomCode ?? '';
    const aliasData = await safeListStudentAliases(classroomCode);
    let audit = {
      classroomCode,
      asOf: new Date().toISOString(),
      retentionDays: 180,
      studentCount: aliasData.aliases.length,
      activeSessionCount: 0,
      tradeCount: 0,
      buyCount: 0,
      sellCount: 0,
      topSymbols: [] as Array<{ symbol: string; trades: number }>,
      storage: aliasData.storage,
      piiIncluded: false,
    };

    try {
      const stockAudit = await getAuditWithTeacherResync(body, teacherUserId);
      audit = {
        ...stockAudit,
        studentCount: aliasData.aliases.length,
        storage: aliasData.storage,
      };
    } catch (error) {
      if (
        teacherUserId &&
        error instanceof StockGameError &&
        error.status === 404 &&
        error.message === 'Classroom was not found.'
      ) {
        // Keep Neon alias-based baseline audit payload.
      } else {
        throw error;
      }
    }

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
