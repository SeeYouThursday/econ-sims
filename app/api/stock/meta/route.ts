import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

function sanitizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function fallbackTickerName(symbol: string) {
  return `Ticker ${symbol}`;
}

function parseSymbols(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map(sanitizeSymbol)
        .filter((symbol) => /^[A-Z.\-]{1,10}$/.test(symbol)),
    ),
  ).slice(0, 50);
}

async function fetchPolygonTickerName(symbol: string) {
  if (!POLYGON_API_KEY) {
    return fallbackTickerName(symbol);
  }

  const url = `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(symbol)}?apiKey=${POLYGON_API_KEY}`;
  const response = await fetch(url, { next: { revalidate: 86400 } });

  if (!response.ok) {
    return fallbackTickerName(symbol);
  }

  const payload = (await response.json().catch(() => null)) as {
    result?: { name?: unknown };
  } | null;

  const name = payload?.result?.name;
  return typeof name === 'string' && name.trim()
    ? name
    : fallbackTickerName(symbol);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get('symbols'));

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: 'Provide one or more valid symbols in the symbols query.' },
      { status: 400 },
    );
  }

  const names = await Promise.all(
    symbols.map(async (symbol) => [
      symbol,
      await fetchPolygonTickerName(symbol),
    ]),
  );

  return NextResponse.json({
    symbols: Object.fromEntries(names),
  });
}
