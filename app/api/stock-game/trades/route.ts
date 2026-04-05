import { NextResponse } from 'next/server';
import { placeTrade, StockGameError } from '@/lib/stockGameStore';

export const runtime = 'nodejs';

type TradeBody = {
  token?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  shares?: number;
  price?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TradeBody;
    const result = await placeTrade({
      token: body.token ?? '',
      symbol: body.symbol ?? '',
      side: body.side ?? 'buy',
      shares: Number(body.shares),
      price: Number(body.price),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while placing trade.' },
      { status: 500 },
    );
  }
}
