'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  //   Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Info,
  ArrowRight,
  RefreshCcw,
  TrendingUp,
  Users,
  Calendar,
} from 'lucide-react';

const FedGame = () => {
  const [quarter, setQuarter] = useState(1);
  const [inflation, setInflation] = useState(2.0);
  const [unemployment, setUnemployment] = useState(5.0);
  const [interestRate, setInterestRate] = useState(4.0);
  const [history, setHistory] = useState([{ q: 1, inf: 2.0, unp: 5.0 }]);
  const [news, setNews] = useState('Welcome, Chair. Your term begins.');
  const [showHints, setShowHints] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  const advanceQuarter = () => {
    if (quarter >= 16) {
      setGameOver(true);
      return;
    }

    // Economic Logic
    const rateGap = interestRate - 4.0;
    const shock = (Math.random() - 0.5) * 0.4;

    const newInf = Math.max(0.2, inflation + -0.18 * rateGap + shock + 0.05);
    const newUnp = Math.max(2.8, unemployment + 0.22 * rateGap - shock * 0.5);
    const nextQ = quarter + 1;

    setInflation(newInf);
    setUnemployment(newUnp);
    setQuarter(nextQ);
    setHistory([...history, { q: nextQ, inf: newInf, unp: newUnp }]);

    // Random News logic
    if (Math.random() > 0.7) {
      setNews('🚨 Supply chain issues are pushing prices up!');
    } else {
      setNews('The economy remains stable.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden">
      {/* --- REPORT CARD OVERLAY --- */}
      {gameOver && (
        <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <h1 className="text-9xl font-black text-green-600 mb-2">A</h1>
          <h2 className="text-3xl font-bold mb-4">Economic Legend</h2>
          <p className="text-gray-600 mb-8 max-w-md">
            You balanced the scales! Inflation stayed near 2% and the job market
            is booming.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition"
          >
            <RefreshCcw size={20} /> New Term
          </button>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-gray-800 flex items-center justify-center gap-2">
          🏛️ Fed Chair Academy
        </h1>
        <p className="text-gray-500 font-medium">
          The 8th Grade Macroeconomics Simulator
        </p>
      </div>

      {/* --- STATS GRID WITH TAILWIND TOOLTIPS --- */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Inflation Card */}
        <div className="bg-red-500 p-4 rounded-xl text-white relative group">
          <div className="flex items-center justify-center gap-1 text-sm font-bold opacity-90">
            <TrendingUp size={16} /> PRICE OF STUFF
            <Info size={14} className="cursor-help" />
          </div>
          <div className="text-3xl font-black text-center">
            {inflation.toFixed(1)}%
          </div>

          {/* Tooltip text */}
          <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-xs rounded shadow-lg z-20 pointer-events-none">
            Target: 2%. If this is too high, your allowance buys less!
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
          </div>
        </div>

        {/* Unemployment Card */}
        <div className="bg-blue-500 p-4 rounded-xl text-white relative group">
          <div className="flex items-center justify-center gap-1 text-sm font-bold opacity-90">
            <Users size={16} /> JOBLESS RATE
            <Info size={14} className="cursor-help" />
          </div>
          <div className="text-3xl font-black text-center">
            {unemployment.toFixed(1)}%
          </div>

          <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-xs rounded shadow-lg z-20 pointer-events-none">
            Target: 5%. We want people to have jobs so they can buy pizza!
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-slate-600 p-4 rounded-xl text-white">
          <div className="flex items-center justify-center gap-1 text-sm font-bold opacity-90">
            <Calendar size={16} /> YEAR
          </div>
          <div className="text-3xl font-black text-center">
            {Math.ceil(quarter / 4)} / 4
          </div>
        </div>
      </div>

      {/* --- CHART --- */}
      <div className="h-64 w-full mb-8">
        <ResponsiveContainer width="100%" height="100%">
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

      {/* --- CONTROLS --- */}
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
        <div className="mb-6 text-center italic font-bold text-gray-700">
          &quot;{news}&quot;
        </div>

        <div className="mb-8">
          <div className="flex justify-between font-bold text-gray-600 mb-2">
            <span>Interest Rate (The Throttle)</span>
            <span className="text-blue-600 text-xl">
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
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <button
          onClick={advanceQuarter}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl text-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-green-200"
        >
          NEXT QUARTER <ArrowRight />
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={showHints}
            onChange={(e) => setShowHints(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Enable Advisor Hints</span>
        </div>
        {showHints && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-center animate-pulse">
            <p className="font-black text-green-700">
              {(() => {
                if (inflation > 2.5)
                  return '⚠️ PRICES ARE RISING! Raise the interest rate to cool down spending.';
                if (unemployment < 3.8)
                  return '🔥 JOB MARKET TOO HOT! Very low unemployment will cause prices to spike soon. Raise rates slightly.';
                if (unemployment > 6.0)
                  return '📉 RECESSION RISK! People are losing jobs. Lower interest rates to help businesses hire.';
                if (inflation < 1.5)
                  return "🧊 ECONOMY TOO COLD! Prices aren't moving. Lower rates to jumpstart spending.";
                return '✅ GOLDILOCKS ZONE! The economy is just right. Stay the course.';
              })()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FedGame;
