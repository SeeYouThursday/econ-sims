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

export const runtime = 'nodejs';

type TradeBody = {
  token?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  shares?: number;
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getServerExecutionPrice(symbolInput: string) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new StockGameError('Market quote service is unavailable.', 503);
  }

  const symbol = normalizeSymbol(symbolInput);
  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
    throw new StockGameError('Symbol format is invalid.');
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 14);

  const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol,
  )}/range/1/day/${formatDate(from)}/${formatDate(to)}?adjusted=true&sort=asc&limit=60&apiKey=${apiKey}`;

  const polygonRes = await fetch(polygonUrl, {
    next: { revalidate: 300 },
  });

  if (!polygonRes.ok) {
    throw new StockGameError('Unable to load latest market quote.', 502);
  }

  const polygonJson = (await polygonRes.json()) as {
    results?: Array<{ c?: number; t?: number }>;
  };
  const latest = Array.isArray(polygonJson.results)
    ? polygonJson.results[polygonJson.results.length - 1]
    : null;

  if (!latest || typeof latest.c !== 'number' || latest.c <= 0) {
    throw new StockGameError(
      'No recent market quote available for symbol.',
      404,
    );
  }

  const quoteAsOf =
    typeof latest.t === 'number'
      ? new Date(latest.t).toISOString().slice(0, 10)
      : formatDate(to);

  // Polygon returns close as dollars (e.g. 187.32). Convert to integer cents
  // at the boundary so the rest of the system stays in integer math.
  return {
    price: Math.round(latest.c * 100),
    quoteAsOf,
  };
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
