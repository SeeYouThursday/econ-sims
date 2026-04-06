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
  cash: number;
  positions: Record<string, number>;
  holdingsValue: number;
  totalValue: number;
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
  storage: 'redis' | 'memory';
};
