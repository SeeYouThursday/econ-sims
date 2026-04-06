import {
  LeaderboardResponse,
  PortfolioSnapshot,
  StudentSession,
  TradeResult,
} from './types';

type ApiErrorShape = {
  error?: string;
};

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
    typeof candidate.cash === 'number' &&
    typeof candidate.holdingsValue === 'number' &&
    typeof candidate.totalValue === 'number' &&
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
    (candidate.storage === 'redis' || candidate.storage === 'memory') &&
    isPortfolioSnapshot(candidate.portfolio)
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

export async function submitTrade(input: {
  session: StudentSession;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
}): Promise<TradeResult> {
  const response = await fetch('/api/stock-game/trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: input.session.token,
      symbol: input.symbol,
      side: input.side,
      shares: input.shares,
      price: input.price,
    }),
  });

  const payload = await readJsonOrNull(response);
  if (!response.ok || !isTradeResult(payload)) {
    throw new Error(getApiErrorMessage(payload) ?? 'Unable to place trade.');
  }

  return payload;
}
