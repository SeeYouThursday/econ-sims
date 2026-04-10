import { NextResponse } from 'next/server';
import { TeacherAuthError, requireTeacherAuth } from '@/lib/clerk';
import {
  assertTeacherOwnsClassroom,
  TeacherAccessError,
} from '@/lib/teacherStore';
import {
  ensureTeacherClassroom,
  getTeacherAudit,
  StockGameError,
} from '@/lib/stockGameStore';
import {
  isClassroomNotFoundError,
  logStockGameFallback,
  safeListStudentAliasesWithFallback,
} from '../fallbacks';

export const runtime = 'nodejs';

type AuditBody = {
  classroomCode?: string;
  teacherPasscode?: string;
};

function buildBaselineAudit({
  classroomCode,
  studentCount,
  storage,
}: {
  classroomCode: string;
  studentCount: number;
  storage: string;
}) {
  return {
    classroomCode,
    asOf: new Date().toISOString(),
    retentionDays: 180,
    studentCount,
    activeSessionCount: 0,
    tradeCount: 0,
    buyCount: 0,
    sellCount: 0,
    topSymbols: [] as Array<{ symbol: string; trades: number }>,
    storage,
    piiIncluded: false,
  };
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
        startingCash: classroom.startingCash,
      });
    }

    const classroomCode = body.classroomCode ?? '';
    const aliasData = await safeListStudentAliasesWithFallback(
      'audit',
      classroomCode,
    );
    let audit = buildBaselineAudit({
      classroomCode,
      studentCount: aliasData.aliases.length,
      storage: aliasData.storage,
    });

    try {
      const stockAudit = await getAuditWithTeacherResync(body, teacherUserId);
      audit = {
        ...stockAudit,
        studentCount: aliasData.aliases.length,
        storage: aliasData.storage,
      };
    } catch (error) {
      if (teacherUserId && isClassroomNotFoundError(error)) {
        logStockGameFallback('audit', 'stock_audit_unavailable', {
          classroomCode,
          teacherUserId,
        });
      } else {
        throw error;
      }
    }

    return NextResponse.json(audit);
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
      { error: 'Unexpected error while loading classroom audit data.' },
      { status: 500 },
    );
  }
}
