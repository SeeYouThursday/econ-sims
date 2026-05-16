import {
  LeaderboardResponse,
  PortfolioSnapshot,
  StockQuote,
  StudentTradeHistoryResponse,
  StudentSession,
  TradeResult,
} from './types';

type ApiErrorShape = {
  error?: string;
};

function sanitizeTickerSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function fallbackTickerName(symbol: string) {
  return `Ticker ${symbol}`;
}

function getApiErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as ApiErrorShape;
  return typeof candidate.error === 'string' ? candidate.error : null;
}

async function readJsonOrNull(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function isPortfolioSnapshot(value: unknown): value is PortfolioSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PortfolioSnapshot>;
  return (
    typeof candidate.studentId === 'string' &&
    typeof candidate.classroomCode === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.classroomActive === 'boolean' &&
    (typeof candidate.classroomEndsAt === 'string' ||
      candidate.classroomEndsAt === null) &&
    typeof candidate.cash === 'number' &&
    typeof candidate.holdingsValue === 'number' &&
    typeof candidate.totalValue === 'number' &&
    typeof candidate.pnlValue === 'number' &&
    typeof candidate.pnlPercent === 'number' &&
    Boolean(candidate.positions && typeof candidate.positions === 'object')
  );
}

function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LeaderboardResponse>;
  return (
    typeof candidate.classroomCode === 'string' &&
    typeof candidate.asOf === 'string' &&
    (candidate.source === 'computed' || candidate.source === 'cache') &&
    Array.isArray(candidate.entries)
  );
}

function isTradeResult(value: unknown): value is TradeResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TradeResult>;
  return (
    typeof candidate.latestPrice === 'number' &&
    typeof candidate.quoteAsOf === 'string' &&
    typeof candidate.executedAt === 'string' &&
    (candidate.storage === 'neon' ||
      candidate.storage === 'redis' ||
      candidate.storage === 'memory') &&
    isPortfolioSnapshot(candidate.portfolio)
  );
}

function isStockQuote(value: unknown): value is StockQuote {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StockQuote>;
  return (
    typeof candidate.symbol === 'string' &&
    typeof candidate.latestPrice === 'number' &&
    typeof candidate.asOf === 'string'
  );
}

function isStudentTradeHistoryResponse(
  value: unknown,
): value is StudentTradeHistoryResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StudentTradeHistoryResponse>;
  return (
    typeof candidate.classroomCode === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.asOf === 'string' &&
    Array.isArray(candidate.trades)
  );
}

export async function fetchPortfolio(
  token: string,
): Promise<PortfolioSnapshot> {
  const response = await fetch(
    `/api/stock-game/portfolio?token=${encodeURIComponent(token)}`,
    {
      cache: 'no-store',
    },
  );

  const payload = await readJsonOrNull(response);
  if (!response.ok || !isPortfolioSnapshot(payload)) {
    throw new Error(getApiErrorMessage(payload) ?? 'Unable to load portfolio.');
  }

  return payload;
}

export async function fetchLeaderboard(
  classroomCode: string,
): Promise<LeaderboardResponse> {
  const response = await fetch(
    `/api/stock-game/leaderboard?classroomCode=${encodeURIComponent(classroomCode)}`,
    { cache: 'no-store' },
  );

  const payload = await readJsonOrNull(response);
  if (!response.ok || !isLeaderboardResponse(payload)) {
    throw new Error(
      getApiErrorMessage(payload) ?? 'Unable to load classroom leaderboard.',
    );
  }

  return payload;
}

export async function fetchTradeQuote(symbol: string): Promise<StockQuote> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const response = await fetch(
    `/api/stock?symbol=${encodeURIComponent(normalizedSymbol)}&days=7`,
    {
      cache: 'no-store',
    },
  );

  const payload = await readJsonOrNull(response);
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new Error(
      getApiErrorMessage(payload) ?? 'Unable to load stock quote.',
    );
  }

  const candidate = payload as {
    symbol?: unknown;
    candles?: Array<{ close?: unknown; date?: unknown }>;
  };
  const latestCandle = Array.isArray(candidate.candles)
    ? candidate.candles[candidate.candles.length - 1]
    : null;

  // /api/stock returns close as dollars; convert to cents at the boundary so
  // stock-game UI consumers (TradeTicket, etc.) stay in integer math.
  const closeDollars =
    latestCandle && typeof latestCandle.close === 'number'
      ? latestCandle.close
      : Number.NaN;
  const quote = {
    symbol:
      typeof candidate.symbol === 'string'
        ? candidate.symbol
        : normalizedSymbol,
    latestPrice: Number.isFinite(closeDollars)
      ? Math.round(closeDollars * 100)
      : Number.NaN,
    asOf:
      latestCandle && typeof latestCandle.date === 'string'
        ? latestCandle.date
        : '',
  } satisfies StockQuote;

  if (!isStockQuote(quote) || !Number.isFinite(quote.latestPrice)) {
    throw new Error('Unable to load stock quote.');
  }

  return quote;
}

export async function fetchTradeHistory(
  token: string,
  limit = 20,
): Promise<StudentTradeHistoryResponse> {
  const response = await fetch(
    `/api/stock-game/trades?token=${encodeURIComponent(token)}&limit=${encodeURIComponent(String(limit))}`,
    {
      cache: 'no-store',
    },
  );

  const payload = await readJsonOrNull(response);
  if (!response.ok || !isStudentTradeHistoryResponse(payload)) {
    throw new Error(
      getApiErrorMessage(payload) ?? 'Unable to load trade history.',
    );
  }

  return payload;
}

export async function submitTrade(input: {
  session: StudentSession;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
}): Promise<TradeResult> {
  const response = await fetch('/api/stock-game/trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: input.session.token,
      symbol: input.symbol,
      side: input.side,
      shares: input.shares,
    }),
  });

  const payload = await readJsonOrNull(response);
  if (!response.ok || !isTradeResult(payload)) {
    throw new Error(getApiErrorMessage(payload) ?? 'Unable to place trade.');
  }

  return payload;
}

export async function fetchTickerNames(symbols: string[]) {
  const normalized = Array.from(
    new Set(symbols.map(sanitizeTickerSymbol).filter(Boolean)),
  );

  if (normalized.length === 0) {
    return {} as Record<string, string>;
  }

  const fallback = Object.fromEntries(
    normalized.map((symbol) => [symbol, fallbackTickerName(symbol)]),
  ) as Record<string, string>;

  let response: Response;
  let payload: unknown;

  try {
    response = await fetch(
      `/api/stock/meta?symbols=${encodeURIComponent(normalized.join(','))}`,
      {
        cache: 'no-store',
      },
    );

    payload = await readJsonOrNull(response);
  } catch {
    return fallback;
  }
  if (!response.ok || !payload || typeof payload !== 'object') {
    return fallback;
  }

  const candidate = payload as {
    symbols?: Record<string, unknown>;
  };

  if (!candidate.symbols || typeof candidate.symbols !== 'object') {
    return fallback;
  }

  for (const symbol of normalized) {
    const name = candidate.symbols[symbol];
    if (typeof name === 'string' && name.trim()) {
      fallback[symbol] = name;
    }
  }

  return fallback;
}
