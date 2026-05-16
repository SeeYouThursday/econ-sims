import { NextResponse } from 'next/server';
import {
  clientIpKey,
  enforceRateLimit,
  rateLimitKey,
  getCheckRateLimitResult,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import {
  assertCanAttemptStudentTrade,
  listStudentTrades,
  placeTrade,
  StockGameError,
} from '@/lib/stockGameStore';
import { fetchLatestClosePriceQuote } from '@/lib/polygonPrices';

export const runtime = 'nodejs';

type TradeBody = {
  token?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  shares?: number;
};

async function getServerExecutionPrice(symbolInput: string) {
  const result = await fetchLatestClosePriceQuote(symbolInput);
  if (result.ok) {
    return { price: result.price, quoteAsOf: result.quoteAsOf };
  }
  switch (result.reason) {
    case 'missing-key':
      throw new StockGameError('Market quote service is unavailable.', 503);
    case 'invalid-symbol':
      throw new StockGameError('Symbol format is invalid.');
    case 'polygon-error':
      throw new StockGameError('Unable to load latest market quote.', 502);
    case 'no-data':
      throw new StockGameError(
        'No recent market quote available for symbol.',
        404,
      );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TradeBody;
    const ipRateLimited = await enforceRateLimit({
      key: rateLimitKey('student-trades-write-ip', clientIpKey(request)),
      limit: 120,
      windowSeconds: 60,
    });
    if (ipRateLimited) return ipRateLimited;

    const rateLimitResult = await getCheckRateLimitResult({
      key: rateLimitKey(
        'student-trades-write',
        body.token || clientIpKey(request),
      ),
      limit: 30,
      windowSeconds: 60,
    });
    if (!rateLimitResult.allowed) {
      const { rateLimitResponse } = await import('@/lib/rateLimit');
      return rateLimitResponse(rateLimitResult);
    }

    await assertCanAttemptStudentTrade(body.token ?? '');

    const execution = await getServerExecutionPrice(body.symbol ?? '');

    const result = await placeTrade({
      token: body.token ?? '',
      symbol: body.symbol ?? '',
      side: body.side ?? 'buy',
      shares: Number(body.shares),
      price: execution.price,
      quoteAsOf: execution.quoteAsOf,
    });

    return NextResponse.json(
      {
        ...result,
        quoteAsOf: execution.quoteAsOf,
      },
      {
        status: 201,
        headers: rateLimitHeaders(rateLimitResult),
      },
    );
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const rateLimited = await enforceRateLimit({
      key: rateLimitKey('student-trades-read', token || clientIpKey(request)),
      limit: 90,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    const result = await listStudentTrades(token, limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StockGameError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error while loading trade history.' },
      { status: 500 },
    );
  }
}
