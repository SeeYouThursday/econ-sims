import { NextResponse } from 'next/server';
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
