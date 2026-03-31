import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sanitizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  if (!POLYGON_API_KEY) {
    return NextResponse.json(
      { error: 'Missing POLYGON_API_KEY environment variable.' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const symbol = sanitizeSymbol(url.searchParams.get('symbol') ?? 'AAPL');
  const requestedDays = Number(url.searchParams.get('days') ?? '30');
  const days = Number.isNaN(requestedDays)
    ? 30
    : Math.min(Math.max(requestedDays, 7), 90);

  if (!/^[A-Z\.\-]{1,10}$/.test(symbol)) {
    return NextResponse.json(
      { error: 'Invalid symbol format. Use letters, dots, or hyphens only.' },
      { status: 400 },
    );
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - days * 2);

  const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol,
  )}/range/1/day/${formatDate(from)}/${formatDate(to)}?adjusted=true&sort=asc&limit=120&apiKey=${POLYGON_API_KEY}`;

  const polygonRes = await fetch(polygonUrl, {
    next: { revalidate: 86400 },
  });

  if (!polygonRes.ok) {
    const message = await polygonRes.text();
    return NextResponse.json(
      { error: 'Polygon API error', details: message },
      { status: polygonRes.status },
    );
  }

  type PolygonResult = {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  };

  const polygonJson = (await polygonRes.json()) as {
    results?: PolygonResult[];
  };

  const candles = Array.isArray(polygonJson.results)
    ? polygonJson.results.map((row) => ({
        date: new Date(row.t).toISOString().slice(0, 10),
        open: row.o,
        high: row.h,
        low: row.l,
        close: row.c,
        volume: row.v,
      }))
    : [];

  return NextResponse.json(
    {
      symbol,
      days,
      from: formatDate(from),
      to: formatDate(to),
      candles,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    },
  );
}
