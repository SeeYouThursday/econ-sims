'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  ArrowRight,
  TrendingUp,
  Users,
  Calendar,
  Lightbulb,
} from 'lucide-react';
import ReportCard from './ReportCard';

// --- TYPES ---
export interface EconomicData {
  q: number;
  inf: number;
  unp: number;
}

// --- HELPER COMPONENTS ---

/**
 * Floating labels that ride the end of the line
 */
const CustomizedLabel = (props: any) => {
  const { x, y, color, text, index, lastIndex } = props;
  if (index !== lastIndex) return null;

  return (
    <g>
      <rect
        x={x + 2}
        y={y - 10}
        width={48}
        height={16}
        rx={4}
        fill="white"
        fillOpacity={0.9}
      />
      <text
        x={x + 5}
        y={y + 2}
        fill={color}
        fontSize={10}
        fontWeight={900}
        className="uppercase tracking-tighter"
      >
        {text}
      </text>
    </g>
  );
};

/**
 * Smaller stat boxes for the top of the control column
 */
const CompactStat = ({ title, val, color, icon }: any) => (
  <div
    className={`${color} p-4 rounded-2xl text-white shadow-md flex flex-col items-center justify-center`}
  >
    <p className="flex items-center gap-1 text-[9px] font-black opacity-80 mb-1 tracking-widest uppercase">
      {icon} {title}
    </p>
    <p className="text-2xl font-black tabular-nums tracking-tighter">
      {val.toFixed(1)}%
    </p>
  </div>
);

// --- MAIN GAME COMPONENT ---

export default function FedGame() {
  // Game State
  const [quarter, setQuarter] = useState(1);
  const [inflation, setInflation] = useState(2.0);
  const [unemployment, setUnemployment] = useState(5.0);
  const [interestRate, setInterestRate] = useState(6.0);
  const [history, setHistory] = useState<EconomicData[]>([
    { q: 1, inf: 2.0, unp: 5.0 },
  ]);

  // UI State
  const [news, setNews] = useState('Welcome, Chair. Stabilize the economy.');
  const [showHints, setShowHints] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  // Economic Engine News Events
  const newsEvents = [
    {
      m: '⛽ Energy costs are soaring! Shipping is expensive.',
      i: 0.8,
      u: 0.2,
    },
    { m: '💻 Tech breakthrough boosts growth!', i: -0.3, u: -0.5 },
    { m: '📉 Global markets are cooling off.', i: -0.4, u: 0.4 },
    { m: '🏗️ Construction boom! New houses everywhere.', i: 0.5, u: -0.4 },
  ];

  const getAdvice = (): string => {
    if (inflation > 3.0)
      return '⚠️ PRICES ARE TOO HIGH! Raise interest rates to cool the economy.';
    if (unemployment > 6.0)
      return '📉 JOBS ARE SCARCE! Lower interest rates to help businesses hire.';
    if (unemployment < 3.8)
      return '🔥 JOB MARKET TOO HOT! This will cause prices to spike soon. Raise rates.';
    if (inflation < 1.5)
      return '🧊 TOO COLD! Prices are flat. Lower rates to jumpstart spending.';
    return '✅ GOLDILOCKS ZONE! Everything is balanced. Stay the course!';
  };

  const advanceQuarter = () => {
    if (quarter >= 16) return;

    const rateGap = interestRate - 4.0;
    const isShock = Math.random() < 0.35;
    let eInf = 0,
      eUnp = 0;

    if (isShock) {
      const e = newsEvents[Math.floor(Math.random() * newsEvents.length)];
      setNews(e.m);
      eInf = e.i;
      eUnp = e.u;
    } else {
      setNews('The economy remains steady this quarter.');
    }

    // Economics Math
    const nextInf = Math.max(
      0.2,
      inflation + -0.18 * rateGap + eInf + (Math.random() * 0.2 - 0.1),
    );
    const nextUnp = Math.max(
      2.8,
      unemployment + 0.22 * rateGap + eUnp + (Math.random() * 0.2 - 0.1),
    );
    const nextQ = quarter + 1;

    setInflation(nextInf);
    setUnemployment(nextUnp);
    setQuarter(nextQ);
    setHistory([...history, { q: nextQ, inf: nextInf, unp: nextUnp }]);

    if (nextQ >= 16) setGameOver(true);
  };

  return (
    <div className="h-[90vh] max-h-[780px] max-w-5xl mx-auto bg-white rounded-[2.5rem] shadow-2xl border flex flex-col p-6 overflow-hidden select-none relative">
      {/* Game Over Report Card Overlay */}
      {gameOver && (
        <ReportCard
          history={history}
          onRestart={() => window.location.reload()}
        />
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center mb-6 px-2 border-b pb-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            🏛️ FED CHAIR ACADEMY
          </h1>
        </div>
        <div className="flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
          <Calendar size={14} className="text-slate-500" />
          <span className="font-black text-slate-700 text-sm">
            YEAR {Math.ceil(quarter / 4)} OF 4
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* CHART AREA (Left 60%) */}
        <div className="col-span-7 bg-slate-50 rounded-[2rem] p-5 border border-slate-100 flex flex-col shadow-inner">
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex gap-4">
              <span className="text-[10px] font-black text-red-500 flex items-center gap-1 uppercase tracking-widest">
                ● Prices
              </span>
              <span className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase tracking-widest">
                ● Jobs
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history}
                margin={{ top: 10, right: 60, left: -25, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis dataKey="q" hide />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />

                {/* Visual Targets */}
                <ReferenceLine
                  y={2}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  y={5}
                  stroke="#2563eb"
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />

                <Line
                  type="monotone"
                  dataKey="inf"
                  stroke="#ef4444"
                  strokeWidth={5}
                  dot={false}
                  isAnimationActive={false}
                  label={
                    <CustomizedLabel
                      color="#ef4444"
                      text="PRICES"
                      lastIndex={history.length - 1}
                    />
                  }
                />

                <Line
                  type="monotone"
                  dataKey="unp"
                  stroke="#2563eb"
                  strokeWidth={5}
                  dot={false}
                  isAnimationActive={false}
                  label={
                    <CustomizedLabel
                      color="#2563eb"
                      text="JOBS"
                      lastIndex={history.length - 1}
                    />
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CONTROLS AREA (Right 40%) */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* Top Stat Row */}
          <div className="grid grid-cols-2 gap-4">
            <CompactStat
              title="INFLATION"
              val={inflation}
              color="bg-red-500"
              icon={<TrendingUp size={14} />}
            />
            <CompactStat
              title="UNEMPLOYMENT"
              val={unemployment}
              color="bg-blue-600"
              icon={<Users size={14} />}
            />
          </div>

          {/* Main Control Panel */}
          <div className="flex-1 bg-slate-900 rounded-[2rem] p-6 text-white flex flex-col justify-between shadow-2xl">
            {/* News/Briefing */}
            <div className="text-center bg-slate-800/50 p-3 rounded-2xl border border-slate-700">
              <p className="text-blue-400 font-black text-[9px] tracking-[0.2em] uppercase mb-1">
                Briefing
              </p>
              <p className="text-sm font-medium italic opacity-90 leading-tight">
                "{news}"
              </p>
            </div>

            {/* Interest Rate Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-slate-500 font-black text-[10px] tracking-widest uppercase">
                  Interest Rate
                </span>
                <span className="text-4xl font-black tabular-nums">
                  {interestRate.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.25"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={advanceQuarter}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-xl transition-all active:scale-[0.96] shadow-lg flex items-center justify-center gap-2 group"
            >
              NEXT QUARTER{' '}
              <ArrowRight
                size={22}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>

            {/* Hint System */}
            <div className="border-t border-slate-800 pt-4 flex flex-col items-center">
              <button
                onClick={() => setShowHints(!showHints)}
                className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-colors"
              >
                <Lightbulb
                  size={12}
                  className={showHints ? 'text-yellow-400' : ''}
                />{' '}
                Advisor Advice
              </button>

              {showHints && (
                <div className="mt-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[11px] text-blue-200 text-center font-bold leading-snug">
                    {getAdvice()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
