import { NextResponse } from 'next/server';
import { getLeaderboard, StockGameError } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const classroomCode = url.searchParams.get('classroomCode') ?? '';
    const leaderboard = await getLeaderboard(classroomCode);
    return NextResponse.json(leaderboard);
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
