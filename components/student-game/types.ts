export type StudentSession = {
  token: string;
  classroomCode: string;
  username: string;
  expiresAt: string;
};

// All monetary fields below are integer cents (AGENTS.md §3). Convert at the
// display boundary with lib/formatCents — never inline `value / 100`.
export type PortfolioSnapshot = {
  studentId: string;
  classroomCode: string;
  username: string;
  classroomActive: boolean;
  classroomEndsAt: string | null;
  /** cents */
  cash: number;
  positions: Record<string, number>;
  /** cents */
  holdingsValue: number;
  /** cents */
  totalValue: number;
  /** cents */
  pnlValue: number;
  /** percentage with 2 decimal places (e.g. 12.34 means +12.34%) */
  pnlPercent: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  /** cents */
  cash: number;
  /** cents */
  holdingsValue: number;
  /** cents */
  totalValue: number;
};

export type LeaderboardResponse = {
  classroomCode: string;
  asOf: string;
  source: 'computed' | 'cache';
  entries: LeaderboardEntry[];
};

export type TradeResult = {
  portfolio: PortfolioSnapshot;
  /** cents per share */
  latestPrice: number;
  quoteAsOf: string;
  executedAt: string;
  storage: 'neon' | 'redis' | 'memory';
};

export type StudentTradeHistoryEntry = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  /** cents per share */
  price: number;
  quoteAsOf: string;
  executedAt: string;
};

export type StudentTradeHistoryResponse = {
  classroomCode: string;
  username: string;
  asOf: string;
  trades: StudentTradeHistoryEntry[];
};

export type StockQuote = {
  symbol: string;
  /** cents per share */
  latestPrice: number;
  asOf: string;
};
