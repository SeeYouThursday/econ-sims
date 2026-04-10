import { useCallback, useEffect, useState } from 'react';
import { fetchTradeQuote } from './api';
import type { StockQuote } from './types';
import {
  buildTradeSubmission,
  calculateEstimatedOrderValue,
  normalizeTradeSymbol,
} from './tradeTicketUtils';

const DEFAULT_SYMBOL = 'AAPL';

type TradeTicketProps = {
  onSubmit: (input: {
    symbol: string;
    side: 'buy' | 'sell';
    shares: number;
  }) => Promise<void>;
  submitting: boolean;
};

export default function TradeTicket({
  onSubmit,
  submitting,
}: TradeTicketProps) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('1');
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const normalizedSymbol = normalizeTradeSymbol(symbol);

  const loadQuote = useCallback(async (nextSymbol: string) => {
    if (!nextSymbol) {
      setQuote(null);
      setQuoteError('Enter a stock symbol to load a price.');
      return null;
    }

    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const nextQuote = await fetchTradeQuote(nextSymbol);
      setQuote(nextQuote);
      return nextQuote;
    } catch (error) {
      setQuote(null);
      setQuoteError(
        error instanceof Error ? error.message : 'Unable to load stock quote.',
      );
      return null;
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    void loadQuote(DEFAULT_SYMBOL);
  }, [loadQuote]);

  const placeTrade = async () => {
    const activeQuote =
      quote && quote.symbol === normalizedSymbol
        ? quote
        : await loadQuote(normalizedSymbol);

    if (!activeQuote) {
      return;
    }

    await onSubmit(
      buildTradeSubmission({
        symbol: normalizedSymbol,
        side,
        shares,
        quote: activeQuote,
      }),
    );
  };

  const estimatedValue = calculateEstimatedOrderValue(shares, quote);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        Place trade
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-600">Symbol</label>
          <input
            title="Trade symbol"
            aria-label="Trade symbol"
            value={symbol}
            onBlur={() => {
              void loadQuote(symbol.trim().toUpperCase());
            }}
            onChange={(event) => {
              setSymbol(event.target.value);
              setQuoteError(null);
            }}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Side</label>
          <select
            title="Trade side"
            aria-label="Trade side"
            value={side}
            onChange={(event) => setSide(event.target.value as 'buy' | 'sell')}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Shares</label>
          <input
            title="Trade shares"
            aria-label="Trade shares"
            type="number"
            min={1}
            step={1}
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          />
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Latest price
              </label>
              <div className="mt-1 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                {quote ? `$${quote.latestPrice.toFixed(2)}` : '—'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadQuote(normalizedSymbol);
              }}
              disabled={loadingQuote}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingQuote ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Quote as of</span>
          <span className="font-semibold text-slate-900">
            {quote?.asOf ?? '—'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span>Estimated order value</span>
          <span className="font-semibold text-slate-900">
            {estimatedValue !== null && Number.isFinite(estimatedValue)
              ? `$${estimatedValue.toFixed(2)}`
              : '—'}
          </span>
        </div>
      </div>

      {quoteError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {quoteError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={placeTrade}
        disabled={submitting || loadingQuote || !normalizedSymbol}
        className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {submitting ? 'Placing…' : 'Submit trade'}
      </button>
    </div>
  );
}
