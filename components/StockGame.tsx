'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowRight, TrendingUp, BarChart3, DollarSign } from 'lucide-react';
import { fetchStockData } from '@/actions';
import type { StockHistoryPoint, StockInfo } from '@/types';

const STARTING_CAPITAL = 10000;
const DEFAULT_SYMBOL = 'AAPL';

const SUPPORTED_STOCKS: StockInfo[] = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    description: 'Consumer electronics, software, and services.',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    description: 'Software, cloud, and productivity products.',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla',
    description: 'Electric vehicles, energy, and battery technology.',
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet',
    description: 'Search, advertising, and cloud computing.',
  },
  {
    symbol: 'AMZN',
    name: 'Amazon',
    description: 'E-commerce, cloud computing, and logistics.',
  },
];

const normalizeQuery = (value: string) => value.trim().toLowerCase();

const findStock = (value: string): StockInfo | undefined => {
  const normalized = normalizeQuery(value);
  return (
    SUPPORTED_STOCKS.find(
      (stock) =>
        stock.symbol.toLowerCase() === normalized ||
        stock.name.toLowerCase() === normalized,
    ) ?? undefined
  );
};

export default function StockGame() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [query, setQuery] = useState(DEFAULT_SYMBOL);
  const [history, setHistory] = useState<StockHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchPrices = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Enter a symbol or company name.');
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);
    const selectedStock = findStock(trimmedQuery);
    const requestedSymbol = selectedStock?.symbol ?? trimmedQuery.toUpperCase();

    try {
      const json = await fetchStockData(requestedSymbol, 30);
      setSymbol(selectedStock?.symbol ?? json.symbol ?? requestedSymbol);
      setHistory(json.candles ?? []);
      setLastUpdated(json.to ?? '');
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Network error while loading stock data.',
      );
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const performance = useMemo(() => {
    if (history.length < 2) return null;
    const start = history[0].close;
    const end = history[history.length - 1].close;
    const gain = ((end - start) / start) * 100;
    const finalValue = STARTING_CAPITAL * (end / start);

    return {
      gain: Number(gain.toFixed(2)),
      finalValue: Number(finalValue.toFixed(2)),
      startPrice: Number(start.toFixed(2)),
      endPrice: Number(end.toFixed(2)),
    };
  }, [history]);

  const selectedStock = useMemo(
    () =>
      findStock(symbol) ?? {
        symbol,
        name: symbol,
        description: 'A supported stock symbol from the lookup list.',
      },
    [symbol],
  );

  return (
    <div className="mx-auto max-w-5xl rounded-4xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
      <div className="mb-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:items-end">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 font-black">
            Stock Market POC
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
            Simulate end-of-day trading with real market data
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            This proof of concept pulls daily close prices from Polygon and
            caches results for the day. It is designed for low-cost usage and
            minimal backend calls.
          </p>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl min-w-0">
            <p className="text-[11px] uppercase tracking-[0.25em] opacity-80">
              Starting capital
            </p>
            <p className="mt-3 text-2xl font-black wrap-break-word sm:text-3xl">
              ${STARTING_CAPITAL.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl min-w-0">
            <p className="text-[11px] uppercase tracking-[0.25em] opacity-80">
              Symbol
            </p>
            <p className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
              {symbol}
              <span className="block wrap-break-word pt-1 text-base font-medium text-slate-200">
                ({selectedStock.name})
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid min-w-0 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <label className="block text-sm font-bold text-slate-700">
            Stock symbol or company name
          </label>
          <div className="flex gap-3 flex-col sm:flex-row">
            <div className="flex-1">
              <input
                list="stock-suggestions"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500"
                placeholder="AAPL, Microsoft, Tesla"
              />
              <datalist id="stock-suggestions">
                {SUPPORTED_STOCKS.map((stock) => (
                  <option
                    key={stock.symbol}
                    value={stock.symbol}
                    label={stock.name}
                  />
                ))}
              </datalist>
            </div>
            <button
              onClick={fetchPrices}
              className="inline-flex items-center justify-center rounded-3xl bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load'}
              <ArrowRight size={16} className="ml-2" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUPPORTED_STOCKS.map((stock) => (
              <button
                type="button"
                key={stock.symbol}
                className="min-w-0 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                onClick={() => setQuery(stock.symbol)}
              >
                <span className="block uppercase tracking-[0.12em] text-[10px] text-slate-500">
                  {stock.symbol}
                </span>
                <span className="block wrap-break-word text-sm font-bold text-slate-900">
                  {stock.name}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Select a symbol or type a company name. The game will show the full
            company name and description.
          </p>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-black">
            Overview
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-600">Last updated</span>
              <span className="font-bold text-slate-900 wrap-break-word sm:text-right">
                {lastUpdated || '—'}
              </span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-600">Data points</span>
              <span className="font-bold text-slate-900">{history.length}</span>
            </div>
            {performance ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-slate-600">Price change</span>
                  <span className="font-bold text-slate-900 sm:text-right">
                    {performance.gain}%
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-slate-600">
                    Estimated value
                  </span>
                  <span className="font-bold text-slate-900 wrap-break-word sm:text-right">
                    ${performance.finalValue.toLocaleString()}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-black">
              Stock legend
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
                <span className="font-semibold">Symbol</span>
                <span className="text-right wrap-break-word">
                  {selectedStock.symbol}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
                <span className="font-semibold">Full name</span>
                <span className="text-right wrap-break-word">
                  {selectedStock.name}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
                <span className="font-semibold">Description</span>
                <span className="text-right text-slate-600 wrap-break-word">
                  {selectedStock.description}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-4xl border border-slate-200 bg-slate-50 px-3 py-4 shadow-inner sm:px-4 sm:py-6">
        <div className="h-72 w-full min-w-0 sm:h-80 lg:h-96">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={history}
              margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) => `$${value}`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: unknown) => {
                  if (typeof value === 'number') {
                    return `$${value.toFixed(2)}`;
                  }
                  return String(value ?? '');
                }}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#2563eb"
                strokeWidth={4}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 uppercase tracking-[0.2em] text-[10px] font-black">
            <TrendingUp size={16} /> Market return
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">
            {performance ? `${performance.gain}%` : '—'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Performance over the selected period.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 uppercase tracking-[0.2em] text-[10px] font-black">
            <DollarSign size={16} /> Simulated growth
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">
            {performance ? `$${performance.finalValue.toLocaleString()}` : '—'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Your starting capital modeled on the selected ticker.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 uppercase tracking-[0.2em] text-[10px] font-black">
            <BarChart3 size={16} /> Data range
          </div>
          <p className="mt-4 text-3xl font-black text-slate-900">30 days</p>
          <p className="mt-2 text-sm text-slate-500">
            Cached daily end-of-day prices from Polygon.
          </p>
        </div>
      </div>
    </div>
  );
}
