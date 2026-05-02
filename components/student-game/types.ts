export type StudentSession = {
  token: string;
  classroomCode: string;
  username: string;
  expiresAt: string;
};

export type PortfolioSnapshot = {
  studentId: string;
  classroomCode: string;
  username: string;
  classroomActive: boolean;
  classroomEndsAt: string | null;
  cash: number;
  positions: Record<string, number>;
  holdingsValue: number;
  totalValue: number;
  pnlValue: number;
  pnlPercent: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  cash: number;
  holdingsValue: number;
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
  latestPrice: number;
  asOf: string;
};
