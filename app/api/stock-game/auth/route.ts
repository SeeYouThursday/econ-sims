import { NextResponse } from 'next/server';
import { clientIpKey, enforceRateLimit, rateLimitKey } from '@/lib/rateLimit';
import { loginStudent, StockGameError } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

type LoginBody = {
  classroomCode?: string;
  username?: string;
  studentPasscode?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const rateLimited = await enforceRateLimit({
      key: rateLimitKey(
        'student-auth',
        clientIpKey(request),
        body.classroomCode,
        body.username,
      ),
      limit: 20,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    const classroomRateLimited = await enforceRateLimit({
      key: rateLimitKey(
        'student-auth-classroom',
        clientIpKey(request),
        body.classroomCode,
      ),
      limit: 120,
      windowSeconds: 60,
    });
    if (classroomRateLimited) return classroomRateLimited;

    const session = await loginStudent({
      classroomCode: body.classroomCode ?? '',
      username: body.username ?? '',
      studentPasscode: body.studentPasscode ?? '',
    });

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while signing in.' },
      { status: 500 },
    );
  }
}
