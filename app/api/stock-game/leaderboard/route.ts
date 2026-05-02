import { NextResponse } from 'next/server';
import {
  clientIpKey,
  enforceRateLimit,
  rateLimitKey,
  getCheckRateLimitResult,
  rateLimitHeaders,
  rateLimitResponse,
} from '@/lib/rateLimit';
import { getLeaderboard, StockGameError } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const classroomCode = url.searchParams.get('classroomCode') ?? '';

    if (!classroomCode) {
      return NextResponse.json(
        { error: 'Classroom code is required.' },
        { status: 400 },
      );
    }

    const rateLimitResult = await getCheckRateLimitResult({
      key: rateLimitKey('student-leaderboard', classroomCode),
      limit: 300,
      windowSeconds: 60,
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    const leaderboard = await getLeaderboard(classroomCode);
    return NextResponse.json(leaderboard, {
      headers: rateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while loading leaderboard.' },
      { status: 500 },
    );
  }
}
