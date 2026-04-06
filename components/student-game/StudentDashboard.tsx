'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchLeaderboard, fetchPortfolio, submitTrade } from './api';
import LeaderboardCard from './LeaderboardCard';
import PortfolioCard from './PortfolioCard';
import StudentSessionBanner from './StudentSessionBanner';
import TradeTicket from './TradeTicket';
import {
  LeaderboardResponse,
  PortfolioSnapshot,
  StudentSession,
} from './types';

type StudentDashboardProps = {
  session: StudentSession;
  onSignOut: () => void;
};

export default function StudentDashboard({
  session,
  onSignOut,
}: StudentDashboardProps) {
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submittingTrade, setSubmittingTrade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextPortfolio, nextLeaderboard] = await Promise.all([
        fetchPortfolio(session.token),
        fetchLeaderboard(session.classroomCode),
      ]);

      setPortfolio(nextPortfolio);
      setLeaderboard(nextLeaderboard);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load classroom data.',
      );
    } finally {
      setLoading(false);
    }
  }, [session.classroomCode, session.token]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const handleTradeSubmit = async (input: {
    symbol: string;
    side: 'buy' | 'sell';
    shares: number;
    price: number;
  }) => {
    setSubmittingTrade(true);
    setError(null);

    try {
      const trade = await submitTrade({
        session,
        symbol: input.symbol,
        side: input.side,
        shares: input.shares,
        price: input.price,
      });

      setPortfolio(trade.portfolio);
      const nextLeaderboard = await fetchLeaderboard(session.classroomCode);
      setLeaderboard(nextLeaderboard);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to place trade.',
      );
    } finally {
      setSubmittingTrade(false);
    }
  };

  return (
    <div className="space-y-4">
      <StudentSessionBanner session={session} onSignOut={onSignOut} />

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading classroom data...
        </div>
      ) : null}

      {!loading && portfolio && leaderboard ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="space-y-4">
            <PortfolioCard portfolio={portfolio} />
            <TradeTicket
              onSubmit={handleTradeSubmit}
              submitting={submittingTrade}
            />
          </div>
          <LeaderboardCard leaderboard={leaderboard} />
        </div>
      ) : null}
    </div>
  );
}
