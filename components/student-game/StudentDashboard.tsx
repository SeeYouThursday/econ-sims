'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeaderboard,
  fetchPortfolio,
  fetchTradeHistory,
  submitTrade,
} from './api';
import LeaderboardCard from './LeaderboardCard';
import PortfolioCard from './PortfolioCard';
import StudentSessionBanner from './StudentSessionBanner';
import TradeHistoryCard from './TradeHistoryCard';
import TradeTicket from './TradeTicket';
import {
  LeaderboardResponse,
  PortfolioSnapshot,
  StudentSession,
  StudentTradeHistoryResponse,
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
  const [tradeHistory, setTradeHistory] =
    useState<StudentTradeHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingTrade, setSubmittingTrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFillMessage, setLastFillMessage] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextPortfolio, nextLeaderboard, nextTradeHistory] =
        await Promise.all([
          fetchPortfolio(session.token),
          fetchLeaderboard(session.classroomCode),
          fetchTradeHistory(session.token),
        ]);

      setPortfolio(nextPortfolio);
      setLeaderboard(nextLeaderboard);
      setTradeHistory(nextTradeHistory);
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
  }) => {
    setSubmittingTrade(true);
    setError(null);
    setLastFillMessage(null);

    try {
      const trade = await submitTrade({
        session,
        symbol: input.symbol,
        side: input.side,
        shares: input.shares,
      });

      setPortfolio(trade.portfolio);
      setLastFillMessage(
        `Filled at $${trade.latestPrice.toFixed(2)} (quote ${trade.quoteAsOf}) on ${new Date(trade.executedAt).toLocaleString()}.`,
      );
      const [nextLeaderboard, nextTradeHistory] = await Promise.all([
        fetchLeaderboard(session.classroomCode),
        fetchTradeHistory(session.token),
      ]);
      setLeaderboard(nextLeaderboard);
      setTradeHistory(nextTradeHistory);
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

      {lastFillMessage ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {lastFillMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading classroom data...
        </div>
      ) : null}

      {!loading && portfolio && leaderboard && tradeHistory ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="space-y-4">
            <PortfolioCard portfolio={portfolio} />
            <TradeTicket
              onSubmit={handleTradeSubmit}
              submitting={submittingTrade}
            />
            <TradeHistoryCard history={tradeHistory} />
          </div>
          <LeaderboardCard leaderboard={leaderboard} />
        </div>
      ) : null}
    </div>
  );
}
