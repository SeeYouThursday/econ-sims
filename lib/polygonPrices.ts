function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export type PolygonPriceQuote = {
  price: number;
  quoteAsOf: string;
};

export type PolygonPriceFailure =
  | 'missing-key'
  | 'invalid-symbol'
  | 'polygon-error'
  | 'no-data';

export type PolygonPriceResult =
  | ({ ok: true } & PolygonPriceQuote)
  | { ok: false; reason: PolygonPriceFailure };

/**
 * Fetches the most recent daily close for `symbol` from Polygon. Price is
 * returned in integer cents (AGENTS.md §3). Callers that need granular error
 * handling (e.g. mapping to HTTP status) use this result form;
 * `fetchLatestClosePriceCents` is the loose wrapper used by background
 * refresh paths.
 */
export async function fetchLatestClosePriceQuote(
  symbolInput: string,
): Promise<PolygonPriceResult> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return { ok: false, reason: 'missing-key' };

  const symbol = normalizeSymbol(symbolInput);
  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
    return { ok: false, reason: 'invalid-symbol' };
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 14);

  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol,
  )}/range/1/day/${formatDate(from)}/${formatDate(to)}?adjusted=true&sort=asc&limit=60&apiKey=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 300 } });
  } catch {
    return { ok: false, reason: 'polygon-error' };
  }

  if (!response.ok) return { ok: false, reason: 'polygon-error' };

  const payload = (await response.json().catch(() => null)) as {
    results?: Array<{ c?: number; t?: number }>;
  } | null;

  const latest = Array.isArray(payload?.results)
    ? payload!.results[payload!.results.length - 1]
    : null;

  if (!latest || typeof latest.c !== 'number' || latest.c <= 0) {
    return { ok: false, reason: 'no-data' };
  }

  const quoteAsOf =
    typeof latest.t === 'number'
      ? new Date(latest.t).toISOString().slice(0, 10)
      : formatDate(to);

  // Polygon returns close as dollars (e.g. 187.32). Convert to integer cents
  // at the boundary so the rest of the system stays in integer math.
  return {
    ok: true,
    price: Math.round(latest.c * 100),
    quoteAsOf,
  };
}

/**
 * Loose variant for background-refresh paths: returns `null` on any failure
 * so a stale stored price beats a broken read.
 */
export async function fetchLatestClosePriceCents(
  symbolInput: string,
): Promise<PolygonPriceQuote | null> {
  const result = await fetchLatestClosePriceQuote(symbolInput);
  return result.ok ? { price: result.price, quoteAsOf: result.quoteAsOf } : null;
}
