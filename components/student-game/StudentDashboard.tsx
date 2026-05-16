'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart3, Clock, Trophy, Wallet } from 'lucide-react';
import {
  formatCents,
  formatCentsWhole,
  formatSignedCents,
} from '@/lib/formatCents';
import {
  fetchLeaderboard,
  fetchPortfolio,
  fetchTradeHistory,
  submitTrade,
} from './api';
import LeaderboardCard from './LeaderboardCard';
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

type PerformancePoint = {
  id: string;
  label: string;
  at: string;
  totalValue: number;
  pnlValue: number;
};

function isSessionTokenError(message: string) {
  return (
    message.includes('Invalid session token') ||
    message.includes('Session expired')
  );
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildInitialPerformancePoints(
  portfolio: PortfolioSnapshot,
): PerformancePoint[] {
  // totalValue and pnlValue are integer cents — subtracting them stays exact.
  const startingValue = portfolio.totalValue - portfolio.pnlValue;
  const asOf = new Date().toISOString();

  return [
    {
      id: 'start',
      label: 'Start',
      at: asOf,
      totalValue: startingValue,
      pnlValue: 0,
    },
    {
      id: `snapshot-${asOf}`,
      label: 'Now',
      at: asOf,
      totalValue: portfolio.totalValue,
      pnlValue: portfolio.pnlValue,
    },
  ];
}

function PortfolioTrendCard({
  portfolio,
  points,
}: {
  portfolio: PortfolioSnapshot;
  points: PerformancePoint[];
}) {
  const pnlIsPositive = portfolio.pnlValue >= 0;
  const pnlToneClass = pnlIsPositive ? 'text-emerald-700' : 'text-rose-700';
  const trendColor = '#2563eb';
  const chartData = points.map((point) => ({
    ...point,
    displayTime: point.label === 'Start' ? 'Start' : formatShortTime(point.at),
  }));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Virtual portfolio
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight text-slate-900">
            {formatCents(portfolio.totalValue)}
          </p>
          <p className={`mt-2 text-sm font-bold ${pnlToneClass}`}>
            {formatSignedCents(portfolio.pnlValue)} (
            {portfolio.pnlPercent >= 0 ? '+' : ''}
            {portfolio.pnlPercent.toFixed(2)}%)
          </p>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-100">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Wallet size={15} />
              Cash
            </div>
            <p className="mt-2 truncate text-lg font-black text-slate-900">
              {formatCents(portfolio.cash)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <BarChart3 size={15} />
              Holdings
            </div>
            <p className="mt-2 truncate text-lg font-black text-slate-900">
              {formatCents(portfolio.holdingsValue)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Activity size={15} />
              Change
            </div>
            <p className={`mt-2 truncate text-lg font-black ${pnlToneClass}`}>
              {portfolio.pnlPercent >= 0 ? '+' : ''}
              {portfolio.pnlPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-64 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Session value trend
          </p>
          <p className="text-xs font-semibold text-slate-500">
            Updates after dashboard loads and trades
          </p>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="portfolioValueFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={trendColor} stopOpacity={0.22} />
                <stop offset="95%" stopColor={trendColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#e2e8f0"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="displayTime"
              tick={{ fontSize: 11, fill: '#475569' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => formatCentsWhole(value)}
              tick={{ fontSize: 11, fill: '#475569' }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                if (typeof value === 'number') {
                  return [
                    name === 'pnlValue'
                      ? formatSignedCents(value)
                      : formatCents(value),
                    name === 'pnlValue' ? 'Change' : 'Portfolio value',
                  ];
                }

                return [String(value ?? ''), String(name ?? '')];
              }}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as
                  | PerformancePoint
                  | undefined;
                return point?.label ?? '';
              }}
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={trendColor}
              strokeWidth={3}
              fill="url(#portfolioValueFill)"
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PositionsPanel({ portfolio }: { portfolio: PortfolioSnapshot }) {
  const positionEntries = Object.entries(portfolio.positions);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Current positions
      </p>
      {positionEntries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          No stocks are currently held in this virtual portfolio.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {positionEntries.map(([symbol, shares]) => (
            <div
              key={symbol}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="text-sm font-black text-slate-900">
                {symbol}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                {shares} shares
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
  const [performancePoints, setPerformancePoints] = useState<
    PerformancePoint[]
  >([]);
  const classroomEnded = portfolio ? !portfolio.classroomActive : false;
  const studentRank = useMemo(() => {
    if (!leaderboard) {
      return null;
    }

    return (
      leaderboard.entries.find((entry) => entry.username === session.username)
        ?.rank ?? null
    );
  }, [leaderboard, session.username]);
  const classroomDaysLeft = (() => {
    if (!portfolio?.classroomActive || !portfolio.classroomEndsAt) {
      return null;
    }

    const endsAtMs = Date.parse(portfolio.classroomEndsAt);
    if (!Number.isFinite(endsAtMs)) {
      return null;
    }

    const msRemaining = endsAtMs - Date.now();
    if (msRemaining <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  })();
  const classroomActiveMessage =
    classroomDaysLeft !== null
      ? classroomDaysLeft === 0
        ? 'This game ends today. Finish strong.'
        : `${classroomDaysLeft} day${classroomDaysLeft === 1 ? '' : 's'} left in this game.`
      : null;
  const classroomEndedMessage = classroomEnded
    ? `This game has ended${portfolio?.classroomEndsAt ? ` on ${new Date(portfolio.classroomEndsAt).toLocaleDateString()}` : ''}. You can still view your results, but trading is turned off.`
    : null;

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
      setPerformancePoints((currentPoints) =>
        currentPoints.length > 0
          ? currentPoints
          : buildInitialPerformancePoints(nextPortfolio),
      );
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load classroom data.';

      if (isSessionTokenError(message)) {
        onSignOut();
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onSignOut, session.classroomCode, session.token]);

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
      setPerformancePoints((currentPoints) => [
        ...(currentPoints.length > 0
          ? currentPoints
          : buildInitialPerformancePoints(trade.portfolio)),
        {
          id: trade.executedAt,
          label: input.side === 'buy' ? 'Buy' : 'Sell',
          at: trade.executedAt,
          totalValue: trade.portfolio.totalValue,
          pnlValue: trade.portfolio.pnlValue,
        },
      ]);
      setLastFillMessage(
        `Filled at ${formatCents(trade.latestPrice)} (quote ${trade.quoteAsOf}) on ${new Date(trade.executedAt).toLocaleString()}.`,
      );
      const [nextLeaderboard, nextTradeHistory] = await Promise.all([
        fetchLeaderboard(session.classroomCode),
        fetchTradeHistory(session.token),
      ]);
      setLeaderboard(nextLeaderboard);
      setTradeHistory(nextTradeHistory);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : 'Unable to place trade.';

      if (isSessionTokenError(message)) {
        onSignOut();
        setError('Session expired. Please sign in again.');
        return;
      }

      setError(message);
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

      {classroomActiveMessage && !classroomEnded ? (
        <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          {classroomActiveMessage}
        </div>
      ) : null}

      {classroomEndedMessage ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {classroomEndedMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading classroom data...
        </div>
      ) : null}

      {!loading && portfolio && leaderboard && tradeHistory ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <PortfolioTrendCard
              portfolio={portfolio}
              points={
                performancePoints.length > 0
                  ? performancePoints
                  : buildInitialPerformancePoints(portfolio)
              }
            />
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  <Trophy size={16} />
                  Class rank
                </div>
                <p className="mt-3 text-3xl font-black text-slate-900">
                  {studentRank ? `#${studentRank}` : 'No rank'}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  <Clock size={16} />
                  Game status
                </div>
                <p className="mt-3 text-sm font-bold text-slate-900">
                  {classroomEnded
                    ? 'Complete'
                    : (classroomActiveMessage ?? 'Active')}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  <Activity size={16} />
                  Trades
                </div>
                <p className="mt-3 text-3xl font-black text-slate-900">
                  {tradeHistory.trades.length}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <div className="space-y-4">
              <PositionsPanel portfolio={portfolio} />
              <TradeHistoryCard history={tradeHistory} />
            </div>
            <div className="space-y-4">
              <TradeTicket
                onSubmit={handleTradeSubmit}
                submitting={submittingTrade}
                tradingDisabled={classroomEnded}
                disabledReason={
                  classroomEnded
                    ? 'Trading is off because this classroom game has ended.'
                    : undefined
                }
                availableCash={portfolio?.cash ?? 0}
                lastFillMessage={lastFillMessage}
                positions={portfolio?.positions}
              />
              <LeaderboardCard leaderboard={leaderboard} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
