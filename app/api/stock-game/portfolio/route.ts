import { NextResponse } from 'next/server';
import { getPortfolio, StockGameError } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const portfolio = await getPortfolio(token);
    return NextResponse.json(portfolio);
  } catch (error) {
    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while loading portfolio.' },
      { status: 500 },
    );
  }
}
