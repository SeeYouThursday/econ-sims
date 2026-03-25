'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Info, ArrowRight, TrendingUp, Users, Calendar } from 'lucide-react';
import { EconomicData, NewsEvent } from '../types';
import ReportCard from './ReportCard';

const newsEvents: NewsEvent[] = [
  { m: '⛽ Energy costs are soaring!', i: 0.9, u: 0.2 },
  { m: '💻 Tech breakthrough boosts growth!', i: -0.3, u: -0.6 },
  { m: '📉 Global markets are cooling off.', i: -0.5, u: 0.5 },
  { m: '🏗️ Massive infrastructure spending boom!', i: 0.6, u: -0.4 },
];

const FedGame: React.FC = () => {
  const [quarter, setQuarter] = useState<number>(1);
  const [inflation, setInflation] = useState<number>(2.0);
  const [unemployment, setUnemployment] = useState<number>(5.0);
  const [interestRate, setInterestRate] = useState<number>(4.0);
  const [history, setHistory] = useState<EconomicData[]>([
    { q: 1, inf: 2.0, unp: 5.0, rate: 4.0 },
  ]);
  const [news, setNews] = useState<string>('Welcome, Chair.');
  const [showHints, setShowHints] = useState<boolean>(true);
  const [gameOver, setGameOver] = useState<boolean>(false);

  const advanceQuarter = (): void => {
    if (quarter >= 16) return;

    const rateGap = interestRate - 4.0;
    const shockChance = Math.random() < 0.35;
    let eInf = 0,
      eUnp = 0;

    if (shockChance) {
      const e = newsEvents[Math.floor(Math.random() * newsEvents.length)];
      setNews(`📣 ${e.m}`);
      eInf = e.i;
      eUnp = e.u;
    } else {
      setNews('No News is Good News');
    }

    const nextInf = Math.max(
      0.2,
      inflation + -0.18 * rateGap + eInf + (Math.random() * 0.2 - 0.1),
    );
    const nextUnp = Math.max(
      2.8,
      unemployment + 0.22 * rateGap + eUnp + (Math.random() * 0.2 - 0.1),
    );
    const nextQ = quarter + 1;

    const newEntry: EconomicData = {
      q: nextQ,
      inf: nextInf,
      unp: nextUnp,
      rate: interestRate,
    };
    const newHistory = [...history, newEntry];

    setInflation(nextInf);
    setUnemployment(nextUnp);
    setQuarter(nextQ);
    setHistory(newHistory);

    if (nextQ >= 16) setGameOver(true);
  };

  const getAdvisorAdvice = (): string => {
    if (inflation > 3.0)
      return '⚠️ PRICES ARE TOO HIGH! Your allowance is losing value. Raise interest rates to cool the economy down.';
    if (unemployment > 6.0)
      return '📉 JOBS ARE SCARCE! People are struggling to find work. Lower interest rates to help businesses hire.';
    if (unemployment < 3.5)
      return '🔥 OVERHEATING! The job market is too tight. This usually leads to a price spike later. Raise rates slightly.';
    if (inflation < 1.5)
      return '🧊 TOO COLD! Prices are flat or falling. This can stop growth. Lower rates to get people spending.';
    return '✅ GOLDILOCKS ZONE! The economy is perfectly balanced. Stay the course, Chair!';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-100 relative font-sans">
      {gameOver && (
        <ReportCard
          history={history}
          onRestart={() => window.location.reload()}
        />
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          title="PRICE OF STUFF"
          val={inflation}
          color="bg-red-500"
          icon={<TrendingUp size={16} />}
          tooltip="Target: 2% Inflation"
        />
        <StatCard
          title="JOBLESS RATE"
          val={unemployment}
          color="bg-blue-500"
          icon={<Users size={16} />}
          tooltip="Target: 5% Unemployment"
        />
        <StatCard
          title="YEAR"
          val={Math.ceil(quarter / 4)}
          color="bg-slate-600"
          icon={<Calendar size={16} />}
          tooltip="You have a 4-year term (16 quarters) to keep the economy stable. Your final grade depends on the whole term!"
          isYear
        />
      </div>

      <div className="h-64 w-full mb-8">
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="q" hide />
            <YAxis domain={[0, 10]} />
            <ReferenceLine y={2} stroke="red" strokeDasharray="3 3" />
            <ReferenceLine y={5} stroke="blue" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="inf"
              stroke="#ef4444"
              strokeWidth={4}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="unp"
              stroke="#3b82f6"
              strokeWidth={4}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center">
        <p className="font-bold text-gray-700 mb-6 italic">
          &quot;{news}&quot;
        </p>
        <div className="flex justify-between font-bold text-gray-600 mb-2">
          <span>Interest Rate</span>
          <span className="text-blue-600 text-xl">
            {interestRate.toFixed(2)}%
          </span>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="0.25"
        value={interestRate}
        onChange={(e) => setInterestRate(parseFloat(e.target.value))}
        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-8"
      />
      <button
        onClick={advanceQuarter}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl text-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
      >
        NEXT QUARTER <ArrowRight />
      </button>
      {/* --- ADVISOR HINT SECTION --- */}
      <div className="mt-6 mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <input
            type="checkbox"
            id="hint-toggle"
            checked={showHints}
            onChange={(e) => setShowHints(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label
            htmlFor="hint-toggle"
            className="text-sm font-bold text-gray-600 cursor-pointer select-none"
          >
            💡 Enable Chief Advisor Hints
          </label>
        </div>

        {showHints && (
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl text-blue-900 font-bold text-sm animate-in slide-in-from-top-2 duration-300 text-center">
            <div className="flex gap-2">
              <span className="text-xl">🧐</span>
              <p className="leading-relaxed">{getAdvisorAdvice()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Stat Card Component
const StatCard = ({
  title,
  val,
  color,
  icon,
  tooltip,
  isYear = false,
}: any) => (
  <div className={`${color} p-4 rounded-xl text-white relative group`}>
    <div className="flex items-center justify-center gap-1 text-sm font-bold opacity-90 cursor-help">
      {icon} {title}
      {tooltip && <Info size={14} />}
    </div>
    <div className="text-3xl font-black text-center">
      {isYear ? `${val} / 4` : `${val.toFixed(1)}%`}
    </div>

    {/* TOOLTIP FIX: Added z-50 and adjusted positioning */}
    {tooltip && (
      <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-2xl z-50 text-center pointer-events-none">
        {tooltip}
        {/* The little arrow tip */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
      </div>
    )}
  </div>
);

export default FedGame;
